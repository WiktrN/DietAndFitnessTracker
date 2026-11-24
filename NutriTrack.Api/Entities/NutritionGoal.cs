namespace NutriTrack.Api.Entities;

public class NutritionGoal
{
    public int Id { get; set; }
    public double TargetCalories { get; set; }
    public double TargetProtein { get; set; }
    public double TargetCarbs { get; set; }
    public double TargetFat { get; set; }
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    public DateOnly EffectiveFrom { get; set; } = DateOnly.FromDateTime(DateTime.UtcNow);
}