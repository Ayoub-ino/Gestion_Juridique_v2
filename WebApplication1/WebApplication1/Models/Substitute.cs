namespace WebApplication1.Models
{
    public class Substitute
    {
        public int Id { get; set; }
        public int UserId { get; set; }
        public int SubstituteUserId { get; set; }
        public DateTime DateAssignation { get; set; } = DateTime.Now;
        public DateTime? DateRevocation { get; set; }
        public bool IsActive { get; set; } = true;
    }
}
