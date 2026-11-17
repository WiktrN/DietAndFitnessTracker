using Microsoft.AspNetCore.Mvc;
using NutriTrack.Api.Data;
using NutriTrack.Api.Dtos;
using NutriTrack.Api.Entities;
using NutriTrack.Api.Services;

namespace NutriTrack.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class NutritionController : ControllerBase
{
    private readonly INutritionAiService _nutritionAiService;
    private readonly NutriDbContext _context;

    public NutritionController(INutritionAiService nutritionAiService, NutriDbContext context)
    {
        _nutritionAiService = nutritionAiService;
        _context = context;
    }

    [HttpPost("estimate")]
    public async Task<ActionResult<EstimatedMealResponseDto>> EstimateMeal([FromBody] EstimateMealRequestDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Text))
        {
            return BadRequest("Opis posiłku nie może być pusty.");
        }

        var result = await _nutritionAiService.EstimateMealNutritionAsync(dto.Text);

        if (result == null)
        {
            return StatusCode(500, "Nie udało się przetworzyć posiłku przez AI.");
        }

        return Ok(result);
    }

    [HttpPost("estimate-and-log")]
    public async Task<ActionResult<EstimatedAndLoggedMealResponseDto>> EstimateAndLogMeal([FromBody] EstimateAndLogRequestDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Text))
        {
            return BadRequest("Opis posiłku nie może być pusty.");
        }

        var estimated = await _nutritionAiService.EstimateMealNutritionAsync(dto.Text);

        if (estimated == null)
        {
            return StatusCode(500, "Nie udało się przetworzyć posiłku przez AI.");
        }

        var mealLog = new MealLog
        {
            MealName = estimated.MealName.Trim(),
            TotalCalories = estimated.TotalCalories,
            TotalProtein = estimated.TotalProtein,
            TotalCarbs = estimated.TotalCarbs,
            TotalFat = estimated.TotalFat,
            Date = dto.Date?.ToUniversalTime() ?? DateTime.UtcNow
        };

        _context.MealLogs.Add(mealLog);
        await _context.SaveChangesAsync();

        var response = new EstimatedAndLoggedMealResponseDto(
            MealLogId: mealLog.Id,
            Date: mealLog.Date,
            MealName: mealLog.MealName,
            TotalCalories: mealLog.TotalCalories,
            TotalProtein: mealLog.TotalProtein,
            TotalCarbs: mealLog.TotalCarbs,
            TotalFat: mealLog.TotalFat,
            Items: estimated.Items
        );

        return Created($"/api/meallogs/{mealLog.Id}", response);
    }
}