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

    // GET: api/recipes
    [HttpGet]
    public async Task<ActionResult<IEnumerable<RecipeResponseDto>>> GetRecipes()
    {
        var recipes = await _context.Recipes
            .Include(r => r.Ingredients)
            .AsNoTracking()
            .ToListAsync();

        var response = recipes.Select(r => new RecipeResponseDto(
            r.Id,
            r.Name,
            r.Description,
            r.Servings,
            r.Ingredients.Sum(i => i.Calories),
            r.Ingredients.Sum(i => i.Protein),
            r.Ingredients.Sum(i => i.Carbs),
            r.Ingredients.Sum(i => i.Fat),
            r.Ingredients.Select(i => new IngredientDto(
                i.Name,
                i.AmountInGrams,
                i.Calories,
                i.Protein,
                i.Carbs,
                i.Fat
            )).ToList()
        ));

        return Ok(response);
    }

    // POST: api/recipes
    [HttpPost]
    public async Task<ActionResult<RecipeResponseDto>> CreateRecipe([FromBody] CreateRecipeDto dto)
    {
        var recipe = new Recipe
        {
            Name = dto.Name,
            Description = dto.Description,
            Servings = dto.Servings,
            Ingredients = dto.Ingredients.Select(i => new Ingredient
            {
                Name = i.Name,
                AmountInGrams = i.AmountInGrams,
                Calories = i.Calories,
                Protein = i.Protein,
                Carbs = i.Carbs,
                Fat = i.Fat
            }).ToList()
        };

        _context.Recipes.Add(recipe);
        await _context.SaveChangesAsync();

        var response = new RecipeResponseDto(
            recipe.Id,
            recipe.Name,
            recipe.Description,
            recipe.Servings,
            recipe.Ingredients.Sum(i => i.Calories),
            recipe.Ingredients.Sum(i => i.Protein),
            recipe.Ingredients.Sum(i => i.Carbs),
            recipe.Ingredients.Sum(i => i.Fat),
            recipe.Ingredients.Select(i => new IngredientDto(
                i.Name,
                i.AmountInGrams,
                i.Calories,
                i.Protein,
                i.Carbs,
                i.Fat
            )).ToList()
        );

        return CreatedAtAction(nameof(GetRecipes), new { id = recipe.Id }, response);
    }
}