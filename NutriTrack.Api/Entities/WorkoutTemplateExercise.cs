namespace NutriTrack.Api.Entities;

public class WorkoutTemplateExercise
{
    public int Id { get; set; }
    public int WorkoutTemplateId { get; set; }
    public WorkoutTemplate? WorkoutTemplate { get; set; }

    public string ExerciseName { get; set; } = string.Empty;
    public int OrderIndex { get; set; }
    public int TargetSets { get; set; } = 3;
    public int RestSeconds { get; set; } = 120;
    public string? Notes { get; set; }
    public string MuscleGroup { get; set; } = "Ogólne";
    public string ExerciseType { get; set; } = "Strength"; // "Strength" lub "Cardio"
}