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

    [HttpPost("from-recipe/{recipeId:int}")]
    public async Task<ActionResult<MealLogResponseDto>> LogMealFromRecipe(
        int recipeId,
        [FromBody] LogMealFromRecipeRequestDto? dto = null)
    {
        var servingsConsumed = dto?.ServingsConsumed ?? 1.0;

        if (servingsConsumed <= 0)
        {
            return BadRequest("Liczba spożytych porcji musi być większa od zera.");
        }

        var recipe = await _context.Recipes
            .Include(r => r.Ingredients)
            .FirstOrDefaultAsync(r => r.Id == recipeId);

        if (recipe == null)
        {
            return NotFound($"Nie znaleziono przepisu o ID {recipeId}.");
        }

        var totalServings = recipe.Servings > 0 ? recipe.Servings : 1;
        var ratio = servingsConsumed / totalServings;

        var totalCalories = recipe.Ingredients.Sum(i => i.Calories) * ratio;
        var totalProtein = recipe.Ingredients.Sum(i => i.Protein) * ratio;
        var totalCarbs = recipe.Ingredients.Sum(i => i.Carbs) * ratio;
        var totalFat = recipe.Ingredients.Sum(i => i.Fat) * ratio;

        var mealName = servingsConsumed == 1.0
            ? recipe.Name
            : $"{recipe.Name} ({servingsConsumed} porcji)";

        var mealLog = new MealLog
        {
            MealName = mealName,
            TotalCalories = Math.Round(totalCalories, 1),
            TotalProtein = Math.Round(totalProtein, 1),
            TotalCarbs = Math.Round(totalCarbs, 1),
            TotalFat = Math.Round(totalFat, 1),
            Date = dto?.Date?.ToUniversalTime() ?? DateTime.UtcNow,
            RecipeId = recipe.Id
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

        var totalCalories = Math.Round(mealDtos.Sum(m => m.TotalCalories), 1);
        var totalProtein = Math.Round(mealDtos.Sum(m => m.TotalProtein), 1);
        var totalCarbs = Math.Round(mealDtos.Sum(m => m.TotalCarbs), 1);
        var totalFat = Math.Round(mealDtos.Sum(m => m.TotalFat), 1);

        var goal = await _context.NutritionGoals
            .AsNoTracking()
            .OrderByDescending(g => g.Id)
            .FirstOrDefaultAsync();

        GoalProgressDto? goalProgress = null;
        if (goal != null)
        {
            goalProgress = new GoalProgressDto(
                TargetCalories: goal.TargetCalories,
                RemainingCalories: Math.Round(goal.TargetCalories - totalCalories, 1),
                CaloriesPercentage: goal.TargetCalories > 0 ? Math.Round(totalCalories / goal.TargetCalories * 100, 1) : 0,
                TargetProtein: goal.TargetProtein,
                RemainingProtein: Math.Round(goal.TargetProtein - totalProtein, 1),
                ProteinPercentage: goal.TargetProtein > 0 ? Math.Round(totalProtein / goal.TargetProtein * 100, 1) : 0,
                TargetCarbs: goal.TargetCarbs,
                RemainingCarbs: Math.Round(goal.TargetCarbs - totalCarbs, 1),
                CarbsPercentage: goal.TargetCarbs > 0 ? Math.Round(totalCarbs / goal.TargetCarbs * 100, 1) : 0,
                TargetFat: goal.TargetFat,
                RemainingFat: Math.Round(goal.TargetFat - totalFat, 1),
                FatPercentage: goal.TargetFat > 0 ? Math.Round(totalFat / goal.TargetFat * 100, 1) : 0
            );
        }

        var summary = new DailyNutritionSummaryDto(
            Date: targetDate,
            TotalCalories: totalCalories,
            TotalProtein: totalProtein,
            TotalCarbs: totalCarbs,
            TotalFat: totalFat,
            GoalProgress: goalProgress,
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

    [HttpGet("monthly-status")]
    public async Task<ActionResult<List<DailyCalendarStatusDto>>> GetMonthlyStatus(
        [FromQuery] int year,
        [FromQuery] int month)
    {
        if (year < 2000 || year > 2100 || month < 1 || month > 12)
        {
            return BadRequest("Nieprawidłowy rok lub miesiąc.");
        }

        var firstDay = new DateOnly(year, month, 1);
        var nextMonthFirstDay = firstDay.AddMonths(1);
        var startUtc = firstDay.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);
        var endUtc = nextMonthFirstDay.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);

        var meals = await _context.MealLogs
            .AsNoTracking()
            .Where(m => m.Date >= startUtc && m.Date < endUtc)
            .ToListAsync();

        var goal = await _context.NutritionGoals
            .AsNoTracking()
            .OrderByDescending(g => g.Id)
            .FirstOrDefaultAsync();

        var daysCount = DateTime.DaysInMonth(year, month);
        var result = new List<DailyCalendarStatusDto>(daysCount);

        for (int day = 1; day <= daysCount; day++)
        {
            var currentDate = new DateOnly(year, month, day);
            var dayMeals = meals.Where(m => DateOnly.FromDateTime(m.Date) == currentDate).ToList();

            if (dayMeals.Count == 0)
            {
                result.Add(new DailyCalendarStatusDto(
                    Date: currentDate,
                    Status: "Empty",
                    TotalCalories: 0,
                    TargetCalories: goal?.TargetCalories ?? 0
                ));
                continue;
            }

            var totalCal = Math.Round(dayMeals.Sum(m => m.TotalCalories), 1);
            var totalProt = dayMeals.Sum(m => m.TotalProtein);
            var totalCarbs = dayMeals.Sum(m => m.TotalCarbs);
            var totalFat = dayMeals.Sum(m => m.TotalFat);

            var status = "Partial";
            if (goal != null && goal.TargetCalories > 0)
            {
                bool withinCal = Math.Abs(totalCal - goal.TargetCalories) <= goal.TargetCalories * 0.05;
                bool withinProt = goal.TargetProtein <= 0 || Math.Abs(totalProt - goal.TargetProtein) <= goal.TargetProtein * 0.08;
                bool withinCarbs = goal.TargetCarbs <= 0 || Math.Abs(totalCarbs - goal.TargetCarbs) <= goal.TargetCarbs * 0.08;
                bool withinFat = goal.TargetFat <= 0 || Math.Abs(totalFat - goal.TargetFat) <= goal.TargetFat * 0.08;

                if (withinCal && withinProt && withinCarbs && withinFat)
                {
                    status = "OnTarget";
                }
            }

            result.Add(new DailyCalendarStatusDto(
                Date: currentDate,
                Status: status,
                TotalCalories: totalCal,
                TargetCalories: goal?.TargetCalories ?? 0
            ));
        }

        return Ok(result);
    }

    [HttpPost("from-recipe-custom/{recipeId:int}")]
    public async Task<ActionResult<MealLogResponseDto>> LogFromRecipeCustom(
        int recipeId,
        [FromBody] LogFromRecipeCustomRequestDto dto)
    {
        if (dto.ServingsConsumed <= 0)
        {
            return BadRequest("Liczba porcji musi być większa od zera.");
        }

        var recipe = await _context.Recipes
            .Include(r => r.Ingredients)
            .FirstOrDefaultAsync(r => r.Id == recipeId);

        if (recipe == null)
        {
            return NotFound($"Nie znaleziono przepisu o ID {recipeId}.");
        }

        var overrides = dto.IngredientOverrides?
            .ToDictionary(o => o.IngredientId, o => o.CustomAmountInGrams)
            ?? new Dictionary<int, double>();

        double batchCalories = 0, batchProtein = 0, batchCarbs = 0, batchFat = 0;

        foreach (var ing in recipe.Ingredients)
        {
            double ratio = 1.0;
            if (overrides.TryGetValue(ing.Id, out var customGrams) && ing.AmountInGrams > 0)
            {
                ratio = Math.Max(0, customGrams) / ing.AmountInGrams;
            }

            batchCalories += ing.Calories * ratio;
            batchProtein += ing.Protein * ratio;
            batchCarbs += ing.Carbs * ratio;
            batchFat += ing.Fat * ratio;
        }

        var portionFactor = dto.ServingsConsumed / (recipe.Servings > 0 ? recipe.Servings : 1);

        var mealLog = new MealLog
        {
            Date = dto.Date?.ToUniversalTime() ?? DateTime.UtcNow,
            MealName = dto.ServingsConsumed == 1
                ? recipe.Name
                : $"{recipe.Name} ({dto.ServingsConsumed} porcji)",
            TotalCalories = Math.Round(batchCalories * portionFactor, 1),
            TotalProtein = Math.Round(batchProtein * portionFactor, 1),
            TotalCarbs = Math.Round(batchCarbs * portionFactor, 1),
            TotalFat = Math.Round(batchFat * portionFactor, 1),
            RecipeId = recipe.Id
        };

        _context.MealLogs.Add(mealLog);
        await _context.SaveChangesAsync();

        return Ok(MapToResponseDto(mealLog));
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