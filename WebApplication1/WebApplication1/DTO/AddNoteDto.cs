using System.ComponentModel.DataAnnotations;

namespace WebApplication1.DTO
{
    public class AddNoteDto
    {
        [Required]
        public string Contenu { get; set; } = "";
    }
}
