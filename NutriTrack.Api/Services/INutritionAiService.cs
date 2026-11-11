using NutriTrack.Api.Dtos;

namespace NutriTrack.Api.Services;

public interface INutritionAiService
{
    Task<EstimatedMealResponseDto?> EstimateMealNutritionAsync(string userMealText);
}