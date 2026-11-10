namespace NutriTrack.Api.Entities;
public class Recipe
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public int Servings { get; set; } = 1;

    public List<Ingredient> Ingredients { get; set; } = new();
}