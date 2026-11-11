using Microsoft.AspNetCore.Mvc;
using NutriTrack.Api.Dtos;
using NutriTrack.Api.Services;

namespace NutriTrack.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class NutritionController : ControllerBase
{
    private readonly INutritionAiService _nutritionAiService;

    public NutritionController(INutritionAiService nutritionAiService)
    {
        _nutritionAiService = nutritionAiService;
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
}