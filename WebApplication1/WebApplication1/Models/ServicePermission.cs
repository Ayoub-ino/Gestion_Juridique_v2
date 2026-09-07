namespace WebApplication1.Models
{
    public class ServicePermission
    {
        public int Id { get; set; }

        public int ServiceId { get; set; }
        public Service Service { get; set; } = null!;

        [System.ComponentModel.DataAnnotations.MaxLength(50)]
        public string PermissionKey { get; set; } = string.Empty;

        public bool Enabled { get; set; } = true;
    }
}
