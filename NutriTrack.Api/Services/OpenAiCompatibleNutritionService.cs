using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using NutriTrack.Api.Dtos;

namespace NutriTrack.Api.Services;

public class OpenAiCompatibleNutritionService : INutritionAiService
{
    private readonly HttpClient _httpClient;
    private readonly IConfiguration _configuration;
    private readonly IProductResearchService _productResearchService;

    public OpenAiCompatibleNutritionService(
        HttpClient httpClient,
        IConfiguration configuration,
        IProductResearchService productResearchService)
    {
        _httpClient = httpClient;
        _configuration = configuration;
        _productResearchService = productResearchService;
    }

    public async Task<EstimatedMealResponseDto?> EstimateMealNutritionAsync(string userMealText)
    {
        var apiKey = _configuration["AiConfig:ApiKey"];
        var baseUrl = _configuration["AiConfig:BaseUrl"] ?? "https://api.groq.com/openai/v1/chat/completions";
        var model = _configuration["AiConfig:Model"] ?? "openai/gpt-oss-120b";

        if (string.IsNullOrWhiteSpace(apiKey))
        {
            throw new InvalidOperationException("Brak klucza API w konfiguracji AiConfig:ApiKey.");
        }

        // KROK 1: Ekstrakcja nazw produktów do wyszukania etykiet
        var queries = await ExtractSearchQueriesAsync(userMealText, baseUrl.Trim(), apiKey.Trim(), model.Trim());

        // KROK 2: Pobranie twardych danych z Tavily / Open Food Facts
        var verifiedLabelsContext = await _productResearchService.GatherNutritionContextAsync(userMealText, queries);

        // KROK 3: Finalne obliczenie makro z użyciem znalezionych etykiet
        var systemPrompt = @"
Jesteś precyzyjnym kalkulatorem wartości odżywczych i dietetykiem klinicznym.
Analizujesz opis posiłku użytkownika oraz dostarczone dane z etykiet produktów (jeśli zostały znalezione w bazach zewnętrznych).

Zasady obliczeń:
1. Priorytet etykiet:
   - Jeśli w sekcji 'DANE Z ETYKIET' znajdują się wartości na 100g/100ml dla danego produktu, użyj ich jako bazy do obliczeń zamiast ogólnych uśrednień.
   - Jeśli użytkownik podał w opisie konkretną wartość z opakowania (np. '28g białka na opakowanie'), bezwzględnie ją uwzględnij.
2. Obróbka termiczna i moment ważenia:
   - Jeśli produkt był ważony PO obróbce termicznej (po usmażeniu, upieczeniu, ugotowaniu, wyjęciu z airfryera), uwzględnij utratę wody (yield factor ~20-25% dla mięs i frytek) lub wchłonięcie wody (kasze, ryż, makaron).
   - Jeśli podano ważenie PRZED obróbką lub nie podano momentu ważenia, użyj wartości surowego/suchego produktu z etykiety.
3. Format JSON:
   - Zwróć WYŁĄCZNIE poprawny obiekt JSON o dokładnie następującej strukturze:
{
  ""mealName"": ""Krótka nazwa całego posiłku"",
  ""items"": [
    {
      ""name"": ""Nazwa składnika wraz z przyjętym wariantem (np. surowy / po usmażeniu)"",
      ""amountInGrams"": 100.0,
      ""calories"": 150.0,
      ""protein"": 20.0,
      ""carbs"": 5.0,
      ""fat"": 5.0
    }
  ]
}";

        var userContent = string.IsNullOrWhiteSpace(verifiedLabelsContext)
            ? $"Wylicz dokładne wartości odżywcze dla posiłku: {userMealText}"
            : $"Posiłek użytkownika: {userMealText}\n\nDANE Z ETYKIET (wartości referencyjne na 100g/100ml):\n{verifiedLabelsContext}";

        var contentText = await SendChatCompletionAsync(
            baseUrl.Trim(),
            apiKey.Trim(),
            model.Trim(),
            systemPrompt,
            userContent);

        if (string.IsNullOrWhiteSpace(contentText))
        {
            return null;
        }

        var parsed = JsonSerializer.Deserialize<EstimatedMealResponseDto>(contentText.Trim(), new JsonSerializerOptions
        {
            PropertyNameCaseInsensitive = true
        });

        if (parsed == null)
        {
            return null;
        }

        return parsed with
        {
            TotalCalories = Math.Round(parsed.Items.Sum(i => i.Calories), 1),
            TotalProtein = Math.Round(parsed.Items.Sum(i => i.Protein), 1),
            TotalCarbs = Math.Round(parsed.Items.Sum(i => i.Carbs), 1),
            TotalFat = Math.Round(parsed.Items.Sum(i => i.Fat), 1)
        };
    }

    private async Task<List<string>> ExtractSearchQueriesAsync(
        string userMealText,
        string baseUrl,
        string apiKey,
        string model)
    {
        var extractionPrompt = @"
Wyodrębnij z opisu posiłku listę nazw konkretnych produktów (wraz z marką, jeśli została podana), aby wyszukać ich tabele wartości odżywczych.
Zwróć WYŁĄCZNIE obiekt JSON w formacie: { ""queries"": [""produkt 1"", ""produkt 2""] }.";

        var responseJson = await SendChatCompletionAsync(
            baseUrl,
            apiKey,
            model,
            extractionPrompt,
            userMealText);

        if (string.IsNullOrWhiteSpace(responseJson))
        {
            return new List<string>();
        }

        try
        {
            using var doc = JsonDocument.Parse(responseJson);
            if (doc.RootElement.TryGetProperty("queries", out var queriesProp) &&
                queriesProp.ValueKind == JsonValueKind.Array)
            {
                return queriesProp.EnumerateArray()
                    .Select(q => q.GetString() ?? string.Empty)
                    .Where(s => !string.IsNullOrWhiteSpace(s))
                    .ToList();
            }
        }
        catch
        {
            // Ignorujemy błąd parsowania listy zapytań — silnik obliczy makro z wiedzy bazowej
        }

        return new List<string>();
    }

    private async Task<string?> SendChatCompletionAsync(
        string baseUrl,
        string apiKey,
        string model,
        string systemPrompt,
        string userContent)
    {
        var requestBody = new
        {
            model = model,
            temperature = 0.1,
            response_format = new { type = "json_object" },
            messages = new[]
            {
                new { role = "system", content = systemPrompt },
                new { role = "user", content = userContent }
            }
        };

        using var request = new HttpRequestMessage(HttpMethod.Post, baseUrl)
        {
            Content = new StringContent(JsonSerializer.Serialize(requestBody), Encoding.UTF8, "application/json")
        };

        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", apiKey);

        var response = await _httpClient.SendAsync(request);

        if (!response.IsSuccessStatusCode)
        {
            var errorDetails = await response.Content.ReadAsStringAsync();
            throw new HttpRequestException($"Błąd API AI ({response.StatusCode}): {errorDetails}");
        }

        var responseJson = await response.Content.ReadAsStringAsync();
        using var doc = JsonDocument.Parse(responseJson);

        return doc.RootElement
            .GetProperty("choices")[0]
            .GetProperty("message")
            .GetProperty("content")
            .GetString();
    }
}