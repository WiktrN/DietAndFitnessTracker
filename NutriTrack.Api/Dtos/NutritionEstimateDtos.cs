namespace NutriTrack.Api.Dtos;

public record EstimateMealRequestDto(string Text);

public record EstimatedItemDto(
    string Name,
    double AmountInGrams,
    double Calories,
    double Protein,
    double Carbs,
    double Fat
);

public record EstimatedMealResponseDto(
    string MealName,
    double TotalCalories,
    double TotalProtein,
    double TotalCarbs,
    double TotalFat,
    List<EstimatedItemDto> Items
);

public record EstimateAndLogRequestDto(
    string Text,
    DateTime? Date = null
);

public record EstimatedAndLoggedMealResponseDto(
    int MealLogId,
    DateTime Date,
    string MealName,
    double TotalCalories,
    double TotalProtein,
    double TotalCarbs,
    double TotalFat,
    List<EstimatedItemDto> Items
);