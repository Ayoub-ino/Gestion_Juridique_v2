namespace WebApplication1.Services
{
    /// <summary>
    /// Shared result type used by domain services. Controllers translate
    /// ServiceResult into IActionResult (Ok / NotFound / BadRequest / Forbid...).
    /// </summary>
    public sealed class ServiceResult
    {
        public bool Success { get; init; }
        public int StatusCode { get; init; } = 200;
        public object? Data { get; init; }

        public static ServiceResult Ok(object? data = null) => new() { Success = true, Data = data };

        public static ServiceResult Fail(int statusCode, string error) =>
            new() { Success = false, StatusCode = statusCode, Data = new { error } };
    }
}
