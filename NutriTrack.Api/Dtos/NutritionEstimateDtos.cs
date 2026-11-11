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