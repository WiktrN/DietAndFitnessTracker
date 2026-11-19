namespace NutriTrack.Api.Dtos;

public record CreateRecipeIngredientDto(
    string Name,
    double AmountInGrams,
    double Calories,
    double Protein,
    double Carbs,
    double Fat,
    string? SectionName = null
);

public record CreateRecipeRequestDto(
    string Name,
    string? Description,
    string? Instructions,
    int Servings,
    List<CreateRecipeIngredientDto> Ingredients
);

public record CreateRecipeFromAiRequestDto(
    string Name,
    string? Description,
    string? Instructions,
    int Servings,
    List<EstimatedItemDto> Items
);

public record RecipeIngredientResponseDto(
    int Id,
    string Name,
    double AmountInGrams,
    double Calories,
    double Protein,
    double Carbs,
    double Fat,
    string? SectionName
);

public record RecipeResponseDto(
    int Id,
    string Name,
    string? Description,
    string? Instructions,
    int Servings,
    double TotalCalories,
    double TotalProtein,
    double TotalCarbs,
    double TotalFat,
    List<RecipeIngredientResponseDto> Ingredients
);