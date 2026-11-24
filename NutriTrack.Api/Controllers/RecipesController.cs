using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using NutriTrack.Api.Data;
using NutriTrack.Api.Dtos;
using NutriTrack.Api.Entities;

namespace NutriTrack.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class RecipesController : ControllerBase
{
    private readonly NutriDbContext _context;

    public RecipesController(NutriDbContext context)
    {
        _context = context;
    }

    [HttpGet]
    public async Task<ActionResult<List<RecipeResponseDto>>> GetAllRecipes()
    {
        var recipes = await _context.Recipes
            .AsNoTracking()
            .Include(r => r.Ingredients)
            .OrderByDescending(r => r.Id)
            .ToListAsync();

        return Ok(recipes.Select(MapToResponseDto).ToList());
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<RecipeResponseDto>> GetRecipeById(int id)
    {
        var recipe = await _context.Recipes
            .AsNoTracking()
            .Include(r => r.Ingredients)
            .FirstOrDefaultAsync(r => r.Id == id);

        if (recipe == null)
        {
            return NotFound($"Nie znaleziono przepisu o ID {id}.");
        }

        return Ok(MapToResponseDto(recipe));
    }

    [HttpPost]
    public async Task<ActionResult<RecipeResponseDto>> CreateRecipe([FromBody] CreateRecipeRequestDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Name))
        {
            return BadRequest("Nazwa przepisu nie może być pusta.");
        }

        if (dto.Ingredients == null || dto.Ingredients.Count == 0)
        {
            return BadRequest("Przepis musi zawierać przynajmniej jeden składnik.");
        }

        var recipe = new Recipe
        {
            Name = dto.Name.Trim(),
            Description = dto.Description?.Trim(),
            Instructions = dto.Instructions?.Trim(),
            Servings = dto.Servings > 0 ? dto.Servings : 1,
            Ingredients = dto.Ingredients.Select(i => new Ingredient
            {
                Name = i.Name.Trim(),
                AmountInGrams = i.AmountInGrams,
                Calories = i.Calories,
                Protein = i.Protein,
                Carbs = i.Carbs,
                Fat = i.Fat,
                SectionName = string.IsNullOrWhiteSpace(i.SectionName) ? "Składniki główne" : i.SectionName.Trim()
            }).ToList()
        };

        _context.Recipes.Add(recipe);
        await _context.SaveChangesAsync();

        return CreatedAtAction(nameof(GetRecipeById), new { id = recipe.Id }, MapToResponseDto(recipe));
    }

    [HttpPut("{id:int}")]
    public async Task<ActionResult<RecipeResponseDto>> UpdateRecipe(
        int id,
        [FromBody] CreateRecipeRequestDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Name))
        {
            return BadRequest("Nazwa przepisu nie może być pusta.");
        }

        if (dto.Ingredients == null || dto.Ingredients.Count == 0)
        {
            return BadRequest("Przepis musi zawierać przynajmniej jeden składnik.");
        }

        var recipe = await _context.Recipes
            .Include(r => r.Ingredients)
            .FirstOrDefaultAsync(r => r.Id == id);

        if (recipe == null)
        {
            return NotFound($"Nie znaleziono przepisu o ID {id}.");
        }

        recipe.Name = dto.Name.Trim();
        recipe.Description = dto.Description?.Trim();
        recipe.Instructions = dto.Instructions?.Trim();
        recipe.Servings = dto.Servings > 0 ? dto.Servings : 1;

        _context.Ingredients.RemoveRange(recipe.Ingredients);

        recipe.Ingredients = dto.Ingredients.Select(i => new Ingredient
        {
            RecipeId = recipe.Id,
            Name = i.Name.Trim(),
            AmountInGrams = i.AmountInGrams,
            Calories = i.Calories,
            Protein = i.Protein,
            Carbs = i.Carbs,
            Fat = i.Fat,
            SectionName = string.IsNullOrWhiteSpace(i.SectionName) ? "Składniki główne" : i.SectionName.Trim()
        }).ToList();

        await _context.SaveChangesAsync();

        return Ok(MapToResponseDto(recipe));
    }

    [HttpPost("from-ai")]
    public async Task<ActionResult<RecipeResponseDto>> CreateRecipeFromAi([FromBody] CreateRecipeFromAiRequestDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Name) || dto.Items == null || dto.Items.Count == 0)
        {
            return BadRequest("Podaj nazwę przepisu oraz listę składników.");
        }

        var recipe = new Recipe
        {
            Name = dto.Name.Trim(),
            Description = dto.Description?.Trim(),
            Instructions = dto.Instructions?.Trim(),
            Servings = dto.Servings > 0 ? dto.Servings : 1,
            Ingredients = dto.Items.Select(i => new Ingredient
            {
                Name = i.Name.Trim(),
                AmountInGrams = i.AmountInGrams,
                Calories = i.Calories,
                Protein = i.Protein,
                Carbs = i.Carbs,
                Fat = i.Fat,
                SectionName = "Składniki główne"
            }).ToList()
        };

        _context.Recipes.Add(recipe);
        await _context.SaveChangesAsync();

        return CreatedAtAction(nameof(GetRecipeById), new { id = recipe.Id }, MapToResponseDto(recipe));
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> DeleteRecipe(int id)
    {
        var recipe = await _context.Recipes.FindAsync(id);
        if (recipe == null)
        {
            return NotFound($"Nie znaleziono przepisu o ID {id}.");
        }

        var linkedMeals = await _context.MealLogs
            .Where(m => m.RecipeId == id)
            .ToListAsync();

        foreach (var meal in linkedMeals)
        {
            meal.RecipeId = null;
        }

        _context.Recipes.Remove(recipe);
        await _context.SaveChangesAsync();

        return NoContent();
    }

    private static RecipeResponseDto MapToResponseDto(Recipe recipe) =>
        new(
            Id: recipe.Id,
            Name: recipe.Name,
            Description: recipe.Description,
            Instructions: recipe.Instructions,
            Servings: recipe.Servings,
            TotalCalories: Math.Round(recipe.Ingredients.Sum(i => i.Calories), 1),
            TotalProtein: Math.Round(recipe.Ingredients.Sum(i => i.Protein), 1),
            TotalCarbs: Math.Round(recipe.Ingredients.Sum(i => i.Carbs), 1),
            TotalFat: Math.Round(recipe.Ingredients.Sum(i => i.Fat), 1),
            Ingredients: recipe.Ingredients.Select(i => new RecipeIngredientResponseDto(
                Id: i.Id,
                Name: i.Name,
                AmountInGrams: i.AmountInGrams,
                Calories: i.Calories,
                Protein: i.Protein,
                Carbs: i.Carbs,
                Fat: i.Fat,
                SectionName: i.SectionName
            )).ToList()
        );
}