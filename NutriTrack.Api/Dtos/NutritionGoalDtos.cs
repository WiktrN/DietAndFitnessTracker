namespace NutriTrack.Api.Dtos;

public record SetNutritionGoalRequestDto(
    double TargetCalories,
    double TargetProtein,
    double TargetCarbs,
    double TargetFat,
    DateOnly? EffectiveFrom = null
);

public record NutritionGoalResponseDto(
    int Id,
    double TargetCalories,
    double TargetProtein,
    double TargetCarbs,
    double TargetFat,
    DateOnly EffectiveFrom,
    DateTime UpdatedAt
);

public record GoalProgressDto(
    double TargetCalories,
    double RemainingCalories,
    double CaloriesPercentage,
    double TargetProtein,
    double RemainingProtein,
    double ProteinPercentage,
    double TargetCarbs,
    double RemainingCarbs,
    double CarbsPercentage,
    double TargetFat,
    double RemainingFat,
    double FatPercentage
);