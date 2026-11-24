using System.Collections.Concurrent;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;

namespace NutriTrack.Api.Services;

public class HybridProductResearchService : IProductResearchService
{
    private readonly HttpClient _httpClient;
    private readonly IConfiguration _configuration;
    private static readonly ConcurrentDictionary<string, string> _cache = new(StringComparer.OrdinalIgnoreCase);

    private static readonly HashSet<string> BasicRawIngredients = new(StringComparer.OrdinalIgnoreCase)
    {
        "woda", "jajko", "jajka", "ryż", "ryż biały", "ryż basmati", "ziemniaki",
        "pierś z kurczaka", "pierś z indyka", "filet z kurczaka", "filet z indyka",
        "banan", "jabłko", "płatki owsiane", "oliwa z oliwek", "oliwa", "masło",
        "cebula", "czosnek", "pomidor", "ogórek", "papryka", "marchew", "szpinak"
    };

    public HybridProductResearchService(HttpClient httpClient, IConfiguration configuration)
    {
        _httpClient = httpClient;
        _configuration = configuration;
    }

    public async Task<string> GatherNutritionContextAsync(string userMealText, List<string> extractedProductQueries)
    {
        if (extractedProductQueries == null || extractedProductQueries.Count == 0)
        {
            return string.Empty;
        }

        var tavilyApiKey = _configuration["AiConfig:TavilyApiKey"];
        var resultsBuilder = new StringBuilder();

        foreach (var rawQuery in extractedProductQueries.Distinct().Take(6))
        {
            var query = rawQuery.Trim();
            if (string.IsNullOrWhiteSpace(query))
                continue;

            // 1. Oszczędność kredytów: podstawowe nieprzetworzone surowce LLM zna sam
            if (BasicRawIngredients.Contains(query))
                continue;

            // 2. Oszczędność kredytów: sprawdzenie pamięci podręcznej
            if (_cache.TryGetValue(query, out var cachedInfo))
            {
                resultsBuilder.AppendLine($"- Produkt [{query}]: {cachedInfo}");
                continue;
            }

            // 3. Najpierw darmowy Open Food Facts (polskie etykiety sklepów)
            string? productInfo = await SearchOpenFoodFactsAsync(query);

            // 4. Dopiero gdy brak w Open Food Facts -> płatne Tavily (1 kredyt)
            if (string.IsNullOrWhiteSpace(productInfo) && !string.IsNullOrWhiteSpace(tavilyApiKey))
            {
                productInfo = await SearchWithTavilyAsync(query, tavilyApiKey.Trim());
            }

            if (!string.IsNullOrWhiteSpace(productInfo))
            {
                _cache[query] = productInfo;
                resultsBuilder.AppendLine($"- Produkt [{query}]: {productInfo}");
            }
        }

        return resultsBuilder.ToString().Trim();
    }

    private async Task<string?> SearchWithTavilyAsync(string productQuery, string apiKey)
    {
        try
        {
            var payload = new
            {
                api_key = apiKey,
                query = $"{productQuery} kcal białko węglowodany tłuszcz w 100g",
                search_depth = "basic",
                max_results = 2,
                include_answer = true,
                include_raw_content = false
            };

            using var request = new HttpRequestMessage(HttpMethod.Post, "https://api.tavily.com/search")
            {
                Content = new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json")
            };

            var response = await _httpClient.SendAsync(request);
            if (!response.IsSuccessStatusCode)
            {
                return null;
            }

            var json = await response.Content.ReadAsStringAsync();
            using var doc = JsonDocument.Parse(json);

            if (doc.RootElement.TryGetProperty("answer", out var answerProp) &&
                !string.IsNullOrWhiteSpace(answerProp.GetString()))
            {
                var answer = answerProp.GetString()!;
                return answer.Length > 400 ? answer[..400] : answer;
            }

            if (doc.RootElement.TryGetProperty("results", out var resultsProp) &&
                resultsProp.GetArrayLength() > 0)
            {
                var snippets = resultsProp.EnumerateArray()
                    .Select(r => r.TryGetProperty("content", out var c) ? c.GetString() : null)
                    .Where(s => !string.IsNullOrWhiteSpace(s))
                    .Select(s => s!.Length > 300 ? s[..300] : s);

                return string.Join(" | ", snippets);
            }
        }
        catch
        {
            // Ignorujemy błędy sieciowe
        }

        return null;
    }

    private async Task<string?> SearchOpenFoodFactsAsync(string productQuery)
    {
        try
        {
            var encodedQuery = Uri.EscapeDataString(productQuery);
            var url = $"https://pl.openfoodfacts.org/cgi/search.pl?search_terms={encodedQuery}&search_simple=1&action=process&json=1&page_size=2";

            using var request = new HttpRequestMessage(HttpMethod.Get, url);
            request.Headers.UserAgent.Add(new ProductInfoHeaderValue("NutriTrackApi", "1.0"));

            var response = await _httpClient.SendAsync(request);
            if (!response.IsSuccessStatusCode)
            {
                return null;
            }

            var json = await response.Content.ReadAsStringAsync();
            using var doc = JsonDocument.Parse(json);

            if (!doc.RootElement.TryGetProperty("products", out var products) ||
                products.GetArrayLength() == 0)
            {
                return null;
            }

            var foundEntries = new List<string>();
            foreach (var prod in products.EnumerateArray())
            {
                var name = prod.TryGetProperty("product_name", out var n) ? n.GetString() : productQuery;
                if (!prod.TryGetProperty("nutriments", out var nutriments))
                {
                    continue;
                }

                var kcal = GetDouble(nutriments, "energy-kcal_100g");
                var protein = GetDouble(nutriments, "proteins_100g");
                var carbs = GetDouble(nutriments, "carbohydrates_100g");
                var fat = GetDouble(nutriments, "fat_100g");

                if (kcal > 0 || protein > 0 || carbs > 0 || fat > 0)
                {
                    foundEntries.Add($"{name} (na 100g: {kcal} kcal, B: {protein}g, W: {carbs}g, T: {fat}g)");
                }
            }

            return foundEntries.Count > 0 ? string.Join("; ", foundEntries) : null;
        }
        catch
        {
            return null;
        }
    }

    private static double GetDouble(JsonElement element, string propertyName)
    {
        if (element.TryGetProperty(propertyName, out var prop) && prop.ValueKind == JsonValueKind.Number)
        {
            return Math.Round(prop.GetDouble(), 1);
        }
        return 0;
    }
}