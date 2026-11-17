namespace NutriTrack.Api.Services;

public static class DependencyInjection
{
    public static IServiceCollection AddNutritionAiServices(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        services.AddHttpClient<IProductResearchService, HybridProductResearchService>();

        var provider = configuration["AiConfig:Provider"] ?? "Groq";

        if (provider.Equals("Groq", StringComparison.OrdinalIgnoreCase) ||
            provider.Equals("OpenAI", StringComparison.OrdinalIgnoreCase))
        {
            services.AddHttpClient<INutritionAiService, OpenAiCompatibleNutritionService>();
        }
        else
        {
            throw new NotSupportedException($"Nieobsługiwany dostawca AI: {provider}");
        }

        return services;
    }
}