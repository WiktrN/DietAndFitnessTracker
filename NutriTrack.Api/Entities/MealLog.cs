namespace NutriTrack.Api.Entities;

public class MealLog
{
    public int Id { get; set; }
    public DateTime Date { get; set; } = DateTime.UtcNow;
    public string MealName { get; set; } = string.Empty;

    public double TotalCalories { get; set; }
    public double TotalProtein { get; set; }
    public double TotalCarbs { get; set; }
    public double TotalFat { get; set; }

    public int? RecipeId { get; set; }
    public Recipe? Recipe { get; set; }
}