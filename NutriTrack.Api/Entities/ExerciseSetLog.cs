namespace NutriTrack.Api.Entities;

public class ExerciseSetLog
{
    public int Id { get; set; }
    public int WorkoutSessionId { get; set; }
    public WorkoutSession? WorkoutSession { get; set; }

    public string ExerciseName { get; set; } = string.Empty;
    public int ExerciseOrder { get; set; }
    public int SetNumber { get; set; }
    public int RestSeconds { get; set; } = 120;
    public string? Notes { get; set; }

    public double WeightKg { get; set; }
    public int Reps { get; set; }
    public bool IsCompleted { get; set; }
    public DateTime? CompletedAt { get; set; }
}