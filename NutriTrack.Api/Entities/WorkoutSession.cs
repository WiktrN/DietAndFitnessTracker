namespace NutriTrack.Api.Entities;

public class WorkoutSession
{
    public int Id { get; set; }
    public int? WorkoutTemplateId { get; set; }
    public WorkoutTemplate? WorkoutTemplate { get; set; }

    public string Name { get; set; } = string.Empty;
    public DateTime StartedAt { get; set; } = DateTime.UtcNow;
    public DateTime? FinishedAt { get; set; }

    public List<ExerciseSetLog> Sets { get; set; } = new();
}