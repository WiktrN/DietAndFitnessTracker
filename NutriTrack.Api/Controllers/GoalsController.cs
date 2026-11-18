using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using NutriTrack.Api.Data;
using NutriTrack.Api.Dtos;
using NutriTrack.Api.Entities;

namespace NutriTrack.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class GoalsController : ControllerBase
{
    private readonly NutriDbContext _context;

    public GoalsController(NutriDbContext context)
    {
        _context = context;
    }

    [HttpGet]
    public async Task<ActionResult<NutritionGoalResponseDto>> GetCurrentGoal()
    {
        var goal = await _context.NutritionGoals
            .AsNoTracking()
            .OrderByDescending(g => g.Id)
            .FirstOrDefaultAsync();

        if (goal == null)
        {
            return NotFound("Nie ustawiono jeszcze żadnego celu makroskładników.");
        }

        return Ok(new NutritionGoalResponseDto(
            goal.Id,
            goal.TargetCalories,
            goal.TargetProtein,
            goal.TargetCarbs,
            goal.TargetFat,
            goal.UpdatedAt
        ));
    }

    [HttpPut]
    public async Task<ActionResult<NutritionGoalResponseDto>> SetGoal([FromBody] SetNutritionGoalRequestDto dto)
    {
        if (dto.TargetCalories <= 0 || dto.TargetProtein < 0 || dto.TargetCarbs < 0 || dto.TargetFat < 0)
        {
            return BadRequest("Kalorie muszą być większe od zera, a makroskładniki nie mogą być ujemne.");
        }

        var goal = await _context.NutritionGoals.OrderByDescending(g => g.Id).FirstOrDefaultAsync();

        if (goal == null)
        {
            goal = new NutritionGoal();
            _context.NutritionGoals.Add(goal);
        }

        goal.TargetCalories = Math.Round(dto.TargetCalories, 1);
        goal.TargetProtein = Math.Round(dto.TargetProtein, 1);
        goal.TargetCarbs = Math.Round(dto.TargetCarbs, 1);
        goal.TargetFat = Math.Round(dto.TargetFat, 1);
        goal.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        return Ok(new NutritionGoalResponseDto(
            goal.Id,
            goal.TargetCalories,
            goal.TargetProtein,
            goal.TargetCarbs,
            goal.TargetFat,
            goal.UpdatedAt
        ));
    }
}