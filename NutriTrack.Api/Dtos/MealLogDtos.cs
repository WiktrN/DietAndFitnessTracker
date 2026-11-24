namespace NutriTrack.Api.Dtos;

public record LogMealRequestDto(
    string MealName,
    double TotalCalories,
    double TotalProtein,
    double TotalCarbs,
    double TotalFat,
    DateTime? Date = null,
    int? RecipeId = null,
    string MealCategory = "Posiłek"
);

public record MealLogResponseDto(
    int Id,
    DateTime Date,
    string MealName,
    double TotalCalories,
    double TotalProtein,
    double TotalCarbs,
    double TotalFat,
    int? RecipeId,
    string MealCategory
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
    DateTime? Date = null,
    string MealCategory = "Posiłek"
);

public record DailyCalendarStatusDto(
    DateOnly Date,
    string Status, // "Empty", "Partial", "OnTarget"
    double TotalCalories,
    double TargetCalories
);

public record IngredientOverrideDto(
    int IngredientId,
    double CustomAmountInGrams
);

public record LogFromRecipeCustomRequestDto(
    double? WeightOnPlateGrams = null,
    double ServingsConsumed = 1.0,
    DateTime? Date = null,
    string MealCategory = "Posiłek",
    List<IngredientOverrideDto>? IngredientOverrides = null
);