namespace NutriTrack.Api.Dtos;

public record IngredientDto(
    string Name,
    double AmountInGrams,
    double Calories,
    double Protein,
    double Carbs,
    double Fat
);

public record CreateRecipeDto(
    string Name,
    string? Description,
    int Servings,
    List<IngredientDto> Ingredients
);

public record RecipeResponseDto(
    int Id,
    string Name,
    string? Description,
    int Servings,
    double TotalCalories,
    double TotalProtein,
    double TotalCarbs,
    double TotalFat,
    List<IngredientDto> Ingredients
);