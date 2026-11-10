using Microsoft.EntityFrameworkCore;
using NutriTrack.Api.Entities;

namespace NutriTrack.Api.Data;

public class NutriDbContext : DbContext
{
    public NutriDbContext(DbContextOptions<NutriDbContext> options) : base(options)
    {
    }

    public DbSet<Recipe> Recipes => Set<Recipe>();
    public DbSet<Ingredient> Ingredients => Set<Ingredient>();
    public DbSet<MealLog> MealLogs => Set<MealLog>();
}