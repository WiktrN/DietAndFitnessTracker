namespace NutriTrack.Api.Services;

public interface IProductResearchService
{
    Task<string> GatherNutritionContextAsync(string userMealText, List<string> extractedProductQueries);
}