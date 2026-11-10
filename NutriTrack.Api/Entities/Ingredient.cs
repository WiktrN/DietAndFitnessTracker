namespace NutriTrack.Api.Entities;

public class Ingredient
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public double AmountInGrams { get; set; }

    public double Calories { get; set; }
    public double Protein { get; set; }
    public double Carbs { get; set; }
    public double Fat { get; set; }

    public int RecipeId { get; set; }
    public Recipe? Recipe { get; set; }
}