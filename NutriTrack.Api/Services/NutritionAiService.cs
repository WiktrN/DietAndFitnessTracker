using System.Text;
using System.Text.Json;
using NutriTrack.Api.Dtos;

namespace NutriTrack.Api.Services;

public class NutritionAiService : INutritionAiService
{
    private readonly HttpClient _httpClient;
    private readonly IConfiguration _configuration;

    public NutritionAiService(HttpClient httpClient, IConfiguration configuration)
    {
        _httpClient = httpClient;
        _configuration = configuration;
    }

    public async Task<EstimatedMealResponseDto?> EstimateMealNutritionAsync(string userMealText)
    {
        var apiKey = _configuration["AiConfig:ApiKey"];
        var model = _configuration["AiConfig:Model"] ?? "gemini-3.8-flash";

        if (string.IsNullOrWhiteSpace(apiKey))
        {
            throw new InvalidOperationException("Brak klucza API w konfiguracji AiConfig:ApiKey.");
        }

        model = model.Replace("models/", "").Trim();

        var requestUrl = $"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={apiKey.Trim()}";

        var prompt = $@"
Działasz jako precyzyjny kalkulator dietetyczny. Przeanalizuj opis posiłku podany przez użytkownika i oszacuj wartości odżywcze dla każdego składnika oraz sumę całego posiłku.
Zwróć odpowiedź w formacie JSON zgodnym z poniższym schematem:
{{
  ""mealName"": ""Krótka nazwa posiłku"",
  ""totalCalories"": 0.0,
  ""totalProtein"": 0.0,
  ""totalCarbs"": 0.0,
  ""totalFat"": 0.0,
  ""items"": [
    {{
      ""name"": ""Nazwa składnika"",
      ""amountInGrams"": 100.0,
      ""calories"": 0.0,
      ""protein"": 0.0,
      ""carbs"": 0.0,
      ""fat"": 0.0
    }}
  ]
}}

Posiłek użytkownika: {userMealText}";

        var requestBody = new
        {
            contents = new[]
            {
                new
                {
                    parts = new[]
                    {
                        new { text = prompt }
                    }
                }
            },
            generationConfig = new
            {
                response_mime_type = "application/json",
                temperature = 0.2
            }
        };

        using var request = new HttpRequestMessage(HttpMethod.Post, requestUrl)
        {
            Content = new StringContent(JsonSerializer.Serialize(requestBody), Encoding.UTF8, "application/json")
        };

        var response = await _httpClient.SendAsync(request);

        if (!response.IsSuccessStatusCode)
        {
            var errorDetails = await response.Content.ReadAsStringAsync();
            throw new HttpRequestException($"Błąd API Gemini ({response.StatusCode}): {errorDetails}");
        }

        var responseJson = await response.Content.ReadAsStringAsync();
        using var doc = JsonDocument.Parse(responseJson);

        var contentText = doc.RootElement
            .GetProperty("candidates")[0]
            .GetProperty("content")
            .GetProperty("parts")[0]
            .GetProperty("text")
            .GetString();

        if (string.IsNullOrWhiteSpace(contentText))
            return null;

        return JsonSerializer.Deserialize<EstimatedMealResponseDto>(contentText.Trim(), new JsonSerializerOptions
        {
            PropertyNameCaseInsensitive = true
        });
    }
}