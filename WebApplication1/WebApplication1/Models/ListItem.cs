namespace WebApplication1.Models
{
    public class ListItem
    {
        public int Id { get; set; }
        public string ListName { get; set; } = string.Empty;
        public string Code { get; set; } = string.Empty;
        public string ValueFr { get; set; } = string.Empty;
        public string ValueAr { get; set; } = string.Empty;
        public int DisplayOrder { get; set; }
        public bool IsActive { get; set; } = true;
    }
}
