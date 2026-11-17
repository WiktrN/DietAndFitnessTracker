using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using NutriTrack.Api.Data;
using NutriTrack.Api.Dtos;
using NutriTrack.Api.Entities;

namespace NutriTrack.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class MealLogsController : ControllerBase
{
    private readonly NutriDbContext _context;

    public MealLogsController(NutriDbContext context)
    {
        _context = context;
    }

    [HttpPost]
    public async Task<ActionResult<MealLogResponseDto>> LogMeal([FromBody] LogMealRequestDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.MealName))
        {
            return BadRequest("Nazwa posiłku nie może być pusta.");
        }

        if (dto.TotalCalories < 0 || dto.TotalProtein < 0 || dto.TotalCarbs < 0 || dto.TotalFat < 0)
        {
            return BadRequest("Wartości odżywcze nie mogą być ujemne.");
        }

        if (dto.RecipeId.HasValue)
        {
            var recipeExists = await _context.Recipes.AnyAsync(r => r.Id == dto.RecipeId.Value);
            if (!recipeExists)
            {
                return NotFound($"Nie znaleziono przepisu o ID {dto.RecipeId.Value}.");
            }
        }

        var mealLog = new MealLog
        {
            MealName = dto.MealName.Trim(),
            TotalCalories = Math.Round(dto.TotalCalories, 1),
            TotalProtein = Math.Round(dto.TotalProtein, 1),
            TotalCarbs = Math.Round(dto.TotalCarbs, 1),
            TotalFat = Math.Round(dto.TotalFat, 1),
            Date = dto.Date?.ToUniversalTime() ?? DateTime.UtcNow,
            RecipeId = dto.RecipeId
        };

        _context.MealLogs.Add(mealLog);
        await _context.SaveChangesAsync();

        var response = MapToResponseDto(mealLog);
        return CreatedAtAction(nameof(GetMealLogById), new { id = mealLog.Id }, response);
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<MealLogResponseDto>> GetMealLogById(int id)
    {
        var mealLog = await _context.MealLogs
            .AsNoTracking()
            .FirstOrDefaultAsync(m => m.Id == id);

        if (mealLog == null)
        {
            return NotFound($"Nie znaleziono wpisu posiłku o ID {id}.");
        }

        return Ok(MapToResponseDto(mealLog));
    }

    [HttpGet("daily")]
    public async Task<ActionResult<DailyNutritionSummaryDto>> GetDailySummary([FromQuery] DateOnly? date = null)
    {
        var targetDate = date ?? DateOnly.FromDateTime(DateTime.UtcNow);
        var startOfDay = targetDate.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);
        var endOfDay = targetDate.AddDays(1).ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);

        var meals = await _context.MealLogs
            .AsNoTracking()
            .Where(m => m.Date >= startOfDay && m.Date < endOfDay)
            .OrderBy(m => m.Date)
            .ToListAsync();

        var mealDtos = meals.Select(MapToResponseDto).ToList();

        var summary = new DailyNutritionSummaryDto(
            Date: targetDate,
            TotalCalories: Math.Round(mealDtos.Sum(m => m.TotalCalories), 1),
            TotalProtein: Math.Round(mealDtos.Sum(m => m.TotalProtein), 1),
            TotalCarbs: Math.Round(mealDtos.Sum(m => m.TotalCarbs), 1),
            TotalFat: Math.Round(mealDtos.Sum(m => m.TotalFat), 1),
            Meals: mealDtos
        );

        return Ok(summary);
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> DeleteMealLog(int id)
    {
        var mealLog = await _context.MealLogs.FindAsync(id);
        if (mealLog == null)
        {
            return NotFound($"Nie znaleziono wpisu posiłku o ID {id}.");
        }

        _context.MealLogs.Remove(mealLog);
        await _context.SaveChangesAsync();

        return NoContent();
    }

    private static MealLogResponseDto MapToResponseDto(MealLog mealLog) =>
        new(
            Id: mealLog.Id,
            Date: mealLog.Date,
            MealName: mealLog.MealName,
            TotalCalories: mealLog.TotalCalories,
            TotalProtein: mealLog.TotalProtein,
            TotalCarbs: mealLog.TotalCarbs,
            TotalFat: mealLog.TotalFat,
            RecipeId: mealLog.RecipeId
        );
}