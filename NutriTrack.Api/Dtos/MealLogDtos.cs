namespace NutriTrack.Api.Dtos;

public record LogMealRequestDto(
    string MealName,
    double TotalCalories,
    double TotalProtein,
    double TotalCarbs,
    double TotalFat,
    DateTime? Date = null,
    int? RecipeId = null
);

public record MealLogResponseDto(
    int Id,
    DateTime Date,
    string MealName,
    double TotalCalories,
    double TotalProtein,
    double TotalCarbs,
    double TotalFat,
    int? RecipeId
);

public record DailyNutritionSummaryDto(
    DateOnly Date,
    double TotalCalories,
    double TotalProtein,
    double TotalCarbs,
    double TotalFat,
    GoalProgressDto? GoalProgress,
    List<MealLogResponseDto> Meals
);

public record LogMealFromRecipeRequestDto(
    double ServingsConsumed = 1.0,
    DateTime? Date = null
);