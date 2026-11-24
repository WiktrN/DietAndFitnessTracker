using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using NutriTrack.Api.Data;
using NutriTrack.Api.Dtos;
using NutriTrack.Api.Entities;

namespace NutriTrack.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class WorkoutTemplatesController : ControllerBase
{
    private readonly NutriDbContext _context;

    public WorkoutTemplatesController(NutriDbContext context)
    {
        _context = context;
    }

    [HttpGet]
    public async Task<ActionResult<List<WorkoutTemplateResponseDto>>> GetAllTemplates()
    {
        var templates = await _context.WorkoutTemplates
            .AsNoTracking()
            .Include(t => t.Exercises.OrderBy(e => e.OrderIndex))
            .OrderBy(t => t.DisplayOrder)
            .ThenBy(t => t.Id)
            .ToListAsync();

        return Ok(templates.Select(MapToResponseDto).ToList());
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<WorkoutTemplateResponseDto>> GetTemplateById(int id)
    {
        var template = await _context.WorkoutTemplates
            .AsNoTracking()
            .Include(t => t.Exercises.OrderBy(e => e.OrderIndex))
            .FirstOrDefaultAsync(t => t.Id == id);

        if (template == null)
        {
            return NotFound($"Nie znaleziono planu treningowego o ID {id}.");
        }

        return Ok(MapToResponseDto(template));
    }

    [HttpPost]
    public async Task<ActionResult<WorkoutTemplateResponseDto>> CreateTemplate([FromBody] CreateWorkoutTemplateDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Name))
        {
            return BadRequest("Nazwa planu treningowego nie może być pusta.");
        }

        if (dto.Exercises == null || dto.Exercises.Count == 0)
        {
            return BadRequest("Plan treningowy musi zawierać przynajmniej jedno ćwiczenie.");
        }

        var template = new WorkoutTemplate
        {
            Name = dto.Name.Trim(),
            Description = dto.Description?.Trim(),
            Exercises = dto.Exercises
                .OrderBy(e => e.OrderIndex)
                .Select((e, idx) => new WorkoutTemplateExercise
                {
                    ExerciseName = e.ExerciseName.Trim(),
                    OrderIndex = e.OrderIndex > 0 ? e.OrderIndex : idx + 1,
                    TargetSets = e.TargetSets > 0 ? e.TargetSets : 3,
                    RestSeconds = e.RestSeconds >= 0 ? e.RestSeconds : 120,
                    MuscleGroup = string.IsNullOrWhiteSpace(e.MuscleGroup) ? "Ogólne" : e.MuscleGroup.Trim(),
                    ExerciseType = string.IsNullOrWhiteSpace(e.ExerciseType) ? "Strength" : e.ExerciseType.Trim(),
                    Notes = e.Notes?.Trim()
                })
                .ToList()
        };

        _context.WorkoutTemplates.Add(template);
        await _context.SaveChangesAsync();

        var response = MapToResponseDto(template);
        return CreatedAtAction(nameof(GetTemplateById), new { id = template.Id }, response);
    }

    [HttpPut("{id:int}")]
    public async Task<ActionResult<WorkoutTemplateResponseDto>> UpdateTemplate(
        int id,
        [FromBody] CreateWorkoutTemplateDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Name))
        {
            return BadRequest("Nazwa planu treningowego nie może być pusta.");
        }

        if (dto.Exercises == null || dto.Exercises.Count == 0)
        {
            return BadRequest("Plan treningowy musi zawierać przynajmniej jedno ćwiczenie.");
        }

        var template = await _context.WorkoutTemplates
            .Include(t => t.Exercises)
            .FirstOrDefaultAsync(t => t.Id == id);

        if (template == null)
        {
            return NotFound($"Nie znaleziono planu treningowego o ID {id}.");
        }

        template.Name = dto.Name.Trim();
        template.Description = dto.Description?.Trim();

        _context.WorkoutTemplateExercises.RemoveRange(template.Exercises);

        template.Exercises = dto.Exercises
            .OrderBy(e => e.OrderIndex)
            .Select((e, idx) => new WorkoutTemplateExercise
            {
                WorkoutTemplateId = template.Id,
                ExerciseName = e.ExerciseName.Trim(),
                OrderIndex = e.OrderIndex > 0 ? e.OrderIndex : idx + 1,
                TargetSets = e.TargetSets > 0 ? e.TargetSets : 3,
                RestSeconds = e.RestSeconds >= 0 ? e.RestSeconds : 120,
                MuscleGroup = string.IsNullOrWhiteSpace(e.MuscleGroup) ? "Ogólne" : e.MuscleGroup.Trim(),
                ExerciseType = string.IsNullOrWhiteSpace(e.ExerciseType) ? "Strength" : e.ExerciseType.Trim(),
                Notes = e.Notes?.Trim()
            })
            .ToList();

        await _context.SaveChangesAsync();

        return Ok(MapToResponseDto(template));
    }

    [HttpPut("reorder")]
    public async Task<IActionResult> ReorderTemplates([FromBody] List<int> orderedIds)
    {
        var templates = await _context.WorkoutTemplates
            .Where(t => orderedIds.Contains(t.Id))
            .ToListAsync();

        for (int i = 0; i < orderedIds.Count; i++)
        {
            var tpl = templates.FirstOrDefault(t => t.Id == orderedIds[i]);
            if (tpl != null)
            {
                tpl.DisplayOrder = i + 1;
            }
        }

        await _context.SaveChangesAsync();
        return NoContent();
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> DeleteTemplate(int id)
    {
        var template = await _context.WorkoutTemplates.FindAsync(id);
        if (template == null)
        {
            return NotFound($"Nie znaleziono planu treningowego o ID {id}.");
        }

        // Odpinamy plan od historycznych i aktywnych sesji, aby zachować historię treningów
        var linkedSessions = await _context.WorkoutSessions
            .Where(s => s.WorkoutTemplateId == id)
            .ToListAsync();

        foreach (var session in linkedSessions)
        {
            session.WorkoutTemplateId = null;
        }

        _context.WorkoutTemplates.Remove(template);
        await _context.SaveChangesAsync();

        return NoContent();
    }

    private static WorkoutTemplateResponseDto MapToResponseDto(WorkoutTemplate template) =>
        new(
            Id: template.Id,
            Name: template.Name,
            Description: template.Description,
            Exercises: template.Exercises
                .OrderBy(e => e.OrderIndex)
                .Select(e => new TemplateExerciseResponseDto(
                    Id: e.Id,
                    ExerciseName: e.ExerciseName,
                    OrderIndex: e.OrderIndex,
                    TargetSets: e.TargetSets,
                    RestSeconds: e.RestSeconds,
                    MuscleGroup: e.MuscleGroup,
                    ExerciseType: e.ExerciseType,
                    Notes: e.Notes
                ))
                .ToList()
        );
}