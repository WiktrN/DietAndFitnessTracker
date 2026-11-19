using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using NutriTrack.Api.Data;
using NutriTrack.Api.Dtos;
using NutriTrack.Api.Entities;

namespace NutriTrack.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class WorkoutSessionsController : ControllerBase
{
    private readonly NutriDbContext _context;

    public WorkoutSessionsController(NutriDbContext context)
    {
        _context = context;
    }

    [HttpPost("start/{templateId:int}")]
    public async Task<ActionResult<WorkoutSessionResponseDto>> StartFromTemplate(int templateId)
    {
        var template = await _context.WorkoutTemplates
            .Include(t => t.Exercises.OrderBy(e => e.OrderIndex))
            .FirstOrDefaultAsync(t => t.Id == templateId);

        if (template == null)
        {
            return NotFound($"Nie znaleziono planu treningowego o ID {templateId}.");
        }

        var session = new WorkoutSession
        {
            WorkoutTemplateId = template.Id,
            Name = template.Name,
            StartedAt = DateTime.UtcNow
        };

        foreach (var exercise in template.Exercises.OrderBy(e => e.OrderIndex))
        {
            var previousSets = await GetLastCompletedSetsForExerciseAsync(exercise.ExerciseName);

            for (int setNum = 1; setNum <= exercise.TargetSets; setNum++)
            {
                var prevSet = previousSets.FirstOrDefault(s => s.SetNumber == setNum);

                session.Sets.Add(new ExerciseSetLog
                {
                    ExerciseName = exercise.ExerciseName,
                    ExerciseOrder = exercise.OrderIndex,
                    SetNumber = setNum,
                    RestSeconds = exercise.RestSeconds,
                    Notes = exercise.Notes,
                    MuscleGroup = exercise.MuscleGroup,
                    ExerciseType = exercise.ExerciseType,
                    WeightKg = prevSet?.WeightKg ?? 0,
                    Reps = prevSet?.Reps ?? 0,
                    IsCompleted = false
                });
            }
        }

        _context.WorkoutSessions.Add(session);
        await _context.SaveChangesAsync();

        var response = await BuildSessionResponseAsync(session);
        return CreatedAtAction(nameof(GetSessionById), new { id = session.Id }, response);
    }

    [HttpPost("start-empty")]
    public async Task<ActionResult<WorkoutSessionResponseDto>> StartEmptySession([FromQuery] string name = "Trening siłowy")
    {
        var session = new WorkoutSession
        {
            Name = string.IsNullOrWhiteSpace(name) ? "Trening siłowy" : name.Trim(),
            StartedAt = DateTime.UtcNow
        };

        _context.WorkoutSessions.Add(session);
        await _context.SaveChangesAsync();

        var response = await BuildSessionResponseAsync(session);
        return CreatedAtAction(nameof(GetSessionById), new { id = session.Id }, response);
    }

    [HttpGet("active")]
    public async Task<ActionResult<WorkoutSessionResponseDto>> GetActiveSession()
    {
        var activeSession = await _context.WorkoutSessions
            .Include(s => s.Sets)
            .Where(s => s.FinishedAt == null)
            .OrderByDescending(s => s.StartedAt)
            .FirstOrDefaultAsync();

        if (activeSession == null)
        {
            return NotFound("Brak aktywnej sesji treningowej.");
        }

        return Ok(await BuildSessionResponseAsync(activeSession));
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<WorkoutSessionResponseDto>> GetSessionById(int id)
    {
        var session = await _context.WorkoutSessions
            .Include(s => s.Sets)
            .FirstOrDefaultAsync(s => s.Id == id);

        if (session == null)
        {
            return NotFound($"Nie znaleziono sesji treningowej o ID {id}.");
        }

        return Ok(await BuildSessionResponseAsync(session));
    }

    [HttpPost("{sessionId:int}/sets")]
    public async Task<ActionResult<SetLogResponseDto>> AddSetToSession(
        int sessionId,
        [FromBody] AddSetToSessionRequestDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.ExerciseName))
        {
            return BadRequest("Nazwa ćwiczenia nie może być pusta.");
        }

        var session = await _context.WorkoutSessions
            .Include(s => s.Sets)
            .FirstOrDefaultAsync(s => s.Id == sessionId);

        if (session == null)
        {
            return NotFound($"Nie znaleziono sesji treningowej o ID {sessionId}.");
        }

        if (session.FinishedAt != null)
        {
            return BadRequest("Nie można dodać serii do zakończonego treningu.");
        }

        var normalizedName = dto.ExerciseName.Trim();
        var existingExerciseSets = session.Sets
            .Where(s => s.ExerciseName.Equals(normalizedName, StringComparison.OrdinalIgnoreCase))
            .OrderBy(s => s.SetNumber)
            .ToList();

        var nextSetNumber = existingExerciseSets.Count > 0
            ? existingExerciseSets.Max(s => s.SetNumber) + 1
            : 1;

        var exerciseOrder = existingExerciseSets.Count > 0
            ? existingExerciseSets.First().ExerciseOrder
            : (session.Sets.Count > 0 ? session.Sets.Max(s => s.ExerciseOrder) + 1 : 1);

        var firstExisting = existingExerciseSets.FirstOrDefault();
        var lastSetInCurrentSession = existingExerciseSets.LastOrDefault();
        var previousSets = await GetLastCompletedSetsForExerciseAsync(normalizedName);
        var prevHistorySet = previousSets.FirstOrDefault(s => s.SetNumber == nextSetNumber);

        var muscleGroup = firstExisting?.MuscleGroup ?? dto.MuscleGroup;
        var exerciseType = firstExisting?.ExerciseType ?? dto.ExerciseType;

        var newSet = new ExerciseSetLog
        {
            WorkoutSessionId = session.Id,
            ExerciseName = normalizedName,
            ExerciseOrder = exerciseOrder,
            SetNumber = nextSetNumber,
            RestSeconds = firstExisting?.RestSeconds ?? dto.RestSeconds,
            Notes = firstExisting?.Notes ?? dto.Notes?.Trim(),
            MuscleGroup = muscleGroup,
            ExerciseType = exerciseType,
            WeightKg = lastSetInCurrentSession?.WeightKg ?? prevHistorySet?.WeightKg ?? 0,
            Reps = lastSetInCurrentSession?.Reps ?? prevHistorySet?.Reps ?? 0,
            IsCompleted = false
        };

        _context.ExerciseSetLogs.Add(newSet);
        await _context.SaveChangesAsync();

        var isCardio = exerciseType == "Cardio" || muscleGroup == "Cardio";
        var previousText = prevHistorySet != null
            ? (isCardio
                ? $"{prevHistorySet.Reps} min @ {prevHistorySet.WeightKg}%"
                : $"{prevHistorySet.Reps} x {prevHistorySet.WeightKg}kg")
            : null;

        return Ok(new SetLogResponseDto(
            Id: newSet.Id,
            SetNumber: newSet.SetNumber,
            PreviousPerformance: previousText,
            WeightKg: newSet.WeightKg,
            Reps: newSet.Reps,
            IsCompleted: newSet.IsCompleted,
            CompletedAt: newSet.CompletedAt
        ));
    }

    [HttpPut("sets/{setId:int}")]
    public async Task<ActionResult<SetLogResponseDto>> UpdateSet(
        int setId,
        [FromBody] UpdateSetLogRequestDto dto)
    {
        if (dto.WeightKg < 0 || dto.Reps < 0)
        {
            return BadRequest("Wartości nie mogą być ujemne.");
        }

        var set = await _context.ExerciseSetLogs
            .Include(s => s.WorkoutSession)
            .FirstOrDefaultAsync(s => s.Id == setId);

        if (set == null)
        {
            return NotFound($"Nie znaleziono serii o ID {setId}.");
        }

        set.WeightKg = Math.Round(dto.WeightKg, 2);
        set.Reps = dto.Reps;
        set.IsCompleted = dto.IsCompleted;
        set.CompletedAt = dto.IsCompleted ? (set.CompletedAt ?? DateTime.UtcNow) : null;

        await _context.SaveChangesAsync();

        var previousSets = await GetLastCompletedSetsForExerciseAsync(set.ExerciseName, excludeSessionId: set.WorkoutSessionId);
        var prevHistorySet = previousSets.FirstOrDefault(s => s.SetNumber == set.SetNumber);
        var isCardio = set.ExerciseType == "Cardio" || set.MuscleGroup == "Cardio";
        var previousText = prevHistorySet != null
            ? (isCardio
                ? $"{prevHistorySet.Reps} min @ {prevHistorySet.WeightKg}%"
                : $"{prevHistorySet.Reps} x {prevHistorySet.WeightKg}kg")
            : null;

        return Ok(new SetLogResponseDto(
            Id: set.Id,
            SetNumber: set.SetNumber,
            PreviousPerformance: previousText,
            WeightKg: set.WeightKg,
            Reps: set.Reps,
            IsCompleted: set.IsCompleted,
            CompletedAt: set.CompletedAt
        ));
    }

    [HttpDelete("sets/{setId:int}")]
    public async Task<IActionResult> DeleteSet(int setId)
    {
        var set = await _context.ExerciseSetLogs.FindAsync(setId);
        if (set == null)
        {
            return NotFound($"Nie znaleziono serii o ID {setId}.");
        }

        var sessionId = set.WorkoutSessionId;
        var exerciseName = set.ExerciseName;

        _context.ExerciseSetLogs.Remove(set);
        await _context.SaveChangesAsync();

        var remainingSets = await _context.ExerciseSetLogs
            .Where(s => s.WorkoutSessionId == sessionId &&
                        s.ExerciseName.ToLower() == exerciseName.ToLower())
            .OrderBy(s => s.SetNumber)
            .ToListAsync();

        for (int i = 0; i < remainingSets.Count; i++)
        {
            remainingSets[i].SetNumber = i + 1;
        }

        await _context.SaveChangesAsync();
        return NoContent();
    }

    [HttpDelete("{sessionId:int}/exercises/{exerciseName}")]
    public async Task<IActionResult> RemoveExerciseFromSession(int sessionId, string exerciseName)
    {
        var decodedName = Uri.UnescapeDataString(exerciseName).Trim();
        var setsToRemove = await _context.ExerciseSetLogs
            .Where(s => s.WorkoutSessionId == sessionId &&
                        s.ExerciseName.ToLower() == decodedName.ToLower())
            .ToListAsync();

        if (setsToRemove.Count == 0)
        {
            return NotFound($"Nie znaleziono ćwiczenia '{decodedName}' w tej sesji.");
        }

        _context.ExerciseSetLogs.RemoveRange(setsToRemove);
        await _context.SaveChangesAsync();
        return NoContent();
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> DeleteSession(int id)
    {
        var session = await _context.WorkoutSessions.FindAsync(id);
        if (session == null)
        {
            return NotFound($"Nie znaleziono sesji treningowej o ID {id}.");
        }

        _context.WorkoutSessions.Remove(session);
        await _context.SaveChangesAsync();
        return NoContent();
    }

    [HttpPost("{id:int}/finish")]
    public async Task<ActionResult<WorkoutSessionResponseDto>> FinishSession(int id)
    {
        var session = await _context.WorkoutSessions
            .Include(s => s.Sets)
            .FirstOrDefaultAsync(s => s.Id == id);

        if (session == null)
        {
            return NotFound($"Nie znaleziono sesji treningowej o ID {id}.");
        }

        session.FinishedAt ??= DateTime.UtcNow;
        await _context.SaveChangesAsync();

        return Ok(await BuildSessionResponseAsync(session));
    }

    [HttpGet("history")]
    public async Task<ActionResult<List<WorkoutSessionResponseDto>>> GetWorkoutHistory([FromQuery] int limit = 10)
    {
        var sessions = await _context.WorkoutSessions
            .AsNoTracking()
            .Include(s => s.Sets)
            .Where(s => s.FinishedAt != null)
            .OrderByDescending(s => s.StartedAt)
            .Take(Math.Clamp(limit, 1, 50))
            .ToListAsync();

        var result = new List<WorkoutSessionResponseDto>();
        foreach (var session in sessions)
        {
            result.Add(await BuildSessionResponseAsync(session));
        }

        return Ok(result);
    }

    private async Task<List<ExerciseSetLog>> GetLastCompletedSetsForExerciseAsync(
        string exerciseName,
        int? excludeSessionId = null)
    {
        var normalized = exerciseName.Trim().ToLower();

        var lastSessionId = await _context.ExerciseSetLogs
            .AsNoTracking()
            .Where(s => s.IsCompleted
                        && s.ExerciseName.ToLower() == normalized
                        && s.WorkoutSession != null
                        && s.WorkoutSession.FinishedAt != null
                        && (!excludeSessionId.HasValue || s.WorkoutSessionId != excludeSessionId.Value))
            .OrderByDescending(s => s.WorkoutSession!.StartedAt)
            .Select(s => (int?)s.WorkoutSessionId)
            .FirstOrDefaultAsync();

        if (!lastSessionId.HasValue)
        {
            return new List<ExerciseSetLog>();
        }

        return await _context.ExerciseSetLogs
            .AsNoTracking()
            .Where(s => s.WorkoutSessionId == lastSessionId.Value
                        && s.IsCompleted
                        && s.ExerciseName.ToLower() == normalized)
            .OrderBy(s => s.SetNumber)
            .ToListAsync();
    }

    private async Task<WorkoutSessionResponseDto> BuildSessionResponseAsync(WorkoutSession session)
    {
        var groupedExercises = new List<SessionExerciseGroupDto>();

        var groups = session.Sets
            .OrderBy(s => s.ExerciseOrder)
            .ThenBy(s => s.SetNumber)
            .GroupBy(s => s.ExerciseName);

        foreach (var group in groups)
        {
            var firstSet = group.First();
            var isCardio = firstSet.ExerciseType == "Cardio" || firstSet.MuscleGroup == "Cardio";
            var previousSets = await GetLastCompletedSetsForExerciseAsync(group.Key, excludeSessionId: session.Id);

            var setDtos = group.Select(s =>
            {
                var prev = previousSets.FirstOrDefault(p => p.SetNumber == s.SetNumber);
                var prevFormatted = prev != null
                    ? (isCardio ? $"{prev.Reps} min @ {prev.WeightKg}%" : $"{prev.Reps} x {prev.WeightKg}kg")
                    : null;

                return new SetLogResponseDto(
                    Id: s.Id,
                    SetNumber: s.SetNumber,
                    PreviousPerformance: prevFormatted,
                    WeightKg: s.WeightKg,
                    Reps: s.Reps,
                    IsCompleted: s.IsCompleted,
                    CompletedAt: s.CompletedAt
                );
            }).ToList();

            groupedExercises.Add(new SessionExerciseGroupDto(
                ExerciseName: group.Key,
                ExerciseOrder: firstSet.ExerciseOrder,
                RestSeconds: firstSet.RestSeconds,
                Notes: firstSet.Notes,
                MuscleGroup: firstSet.MuscleGroup,
                ExerciseType: firstSet.ExerciseType,
                Sets: setDtos
            ));
        }

        var totalVolume = session.Sets
            .Where(s => s.IsCompleted && s.ExerciseType != "Cardio" && s.MuscleGroup != "Cardio")
            .Sum(s => s.WeightKg * s.Reps);

        return new WorkoutSessionResponseDto(
            Id: session.Id,
            WorkoutTemplateId: session.WorkoutTemplateId,
            Name: session.Name,
            StartedAt: session.StartedAt,
            FinishedAt: session.FinishedAt,
            TotalVolumeKg: Math.Round(totalVolume, 1),
            Exercises: groupedExercises
        );
    }
}