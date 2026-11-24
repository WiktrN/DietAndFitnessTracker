namespace NutriTrack.Api.Dtos;

public record CreateTemplateExerciseDto(
    string ExerciseName,
    int OrderIndex,
    int TargetSets = 3,
    int RestSeconds = 120,
    string? Notes = null,
    string MuscleGroup = "Ogólne",
    string ExerciseType = "Strength"
);

public record CreateWorkoutTemplateDto(
    string Name,
    string? Description,
    List<CreateTemplateExerciseDto> Exercises
);

public record TemplateExerciseResponseDto(
    int Id,
    string ExerciseName,
    int OrderIndex,
    int TargetSets,
    int RestSeconds,
    string? Notes,
    string MuscleGroup,
    string ExerciseType
);

public record WorkoutTemplateResponseDto(
    int Id,
    string Name,
    string? Description,
    List<TemplateExerciseResponseDto> Exercises
);

public record UpdateSetLogRequestDto(
    double WeightKg,
    int Reps,
    bool IsCompleted
);

public record AddSetToSessionRequestDto(
    string ExerciseName,
    int RestSeconds = 120,
    string? Notes = null,
    string MuscleGroup = "Ogólne",
    string ExerciseType = "Strength"
);

public record SetLogResponseDto(
    int Id,
    int SetNumber,
    string? PreviousPerformance,
    double WeightKg,
    int Reps,
    bool IsCompleted,
    DateTime? CompletedAt
);

public record SessionExerciseGroupDto(
    string ExerciseName,
    int ExerciseOrder,
    int RestSeconds,
    string? Notes,
    string MuscleGroup,
    string ExerciseType,
    List<SetLogResponseDto> Sets
);

public record WorkoutSessionResponseDto(
    int Id,
    int? WorkoutTemplateId,
    string Name,
    DateTime StartedAt,
    DateTime? FinishedAt,
    double TotalVolumeKg,
    List<SessionExerciseGroupDto> Exercises
);

public record AddHistorySetRequestDto(
    string ExerciseName,
    string MuscleGroup,
    string ExerciseType,
    int Reps,
    double WeightKg
);