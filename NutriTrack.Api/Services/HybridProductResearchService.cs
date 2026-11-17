using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;

namespace NutriTrack.Api.Services;

public class HybridProductResearchService : IProductResearchService
{
    private readonly HttpClient _httpClient;
    private readonly IConfiguration _configuration;

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

        foreach (var query in extractedProductQueries.Distinct().Take(6))
        {
            string? productInfo = null;

            // 1. Próba przez Tavily (jeśli klucz jest skonfigurowany)
            if (!string.IsNullOrWhiteSpace(tavilyApiKey))
            {
                productInfo = await SearchWithTavilyAsync(query, tavilyApiKey.Trim());
            }

            // 2. Fallback na darmowy Open Food Facts (zawsze dostępny bez klucza)
            if (string.IsNullOrWhiteSpace(productInfo))
            {
                productInfo = await SearchOpenFoodFactsAsync(query);
            }

            if (!string.IsNullOrWhiteSpace(productInfo))
            {
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
                query = $"{productQuery} wartości odżywcze kcal białko tłuszcz węglowodany na 100g",
                search_depth = "basic",
                max_results = 2,
                include_answer = true
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
                return answerProp.GetString();
            }

            if (doc.RootElement.TryGetProperty("results", out var resultsProp) &&
                resultsProp.GetArrayLength() > 0)
            {
                var snippets = resultsProp.EnumerateArray()
                    .Select(r => r.TryGetProperty("content", out var c) ? c.GetString() : null)
                    .Where(s => !string.IsNullOrWhiteSpace(s));

                return string.Join(" | ", snippets);
            }
        }
        catch
        {
            // W razie błędu sieciowego przechodzimy płynnie do Open Food Facts
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