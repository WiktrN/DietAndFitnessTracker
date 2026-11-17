using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Mvc;

namespace NutriTrack.Api.Infrastructure;

public sealed class GlobalExceptionHandler(ILogger<GlobalExceptionHandler> logger) : IExceptionHandler
{
    public async ValueTask<bool> TryHandleAsync(
        HttpContext httpContext,
        Exception exception,
        CancellationToken cancellationToken)
    {
        logger.LogError(exception, "Wystąpił nieobsłużony wyjątek podczas przetwarzania żądania: {Message}", exception.Message);

        var (statusCode, title) = exception switch
        {
            HttpRequestException => (StatusCodes.Status503ServiceUnavailable, "Zewnętrzny serwis AI jest chwilowo niedostępny"),
            InvalidOperationException or NotSupportedException => (StatusCodes.Status400BadRequest, "Nieprawidłowa konfiguracja lub żądanie"),
            _ => (StatusCodes.Status500InternalServerError, "Wewnętrzny błąd serwera")
        };

        var problemDetails = new ProblemDetails
        {
            Status = statusCode,
            Title = title,
            Detail = exception.Message,
            Instance = httpContext.Request.Path
        };

        httpContext.Response.StatusCode = statusCode;
        await httpContext.Response.WriteAsJsonAsync(problemDetails, cancellationToken);

        return true;
    }
}