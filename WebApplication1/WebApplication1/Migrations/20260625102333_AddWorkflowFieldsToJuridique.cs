using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace WebApplication1.Migrations
{
    /// <inheritdoc />
    public partial class AddWorkflowFieldsToJuridique : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "AgentDestinataireId",
                table: "Transactions",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "CourrierAdminId",
                table: "Transactions",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<string>(
                name: "NomPersonneExterne",
                table: "Transactions",
                type: "nvarchar(max)",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<int>(
                name: "ServiceDestinataireId",
                table: "Transactions",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "StatutEtape",
                table: "Transactions",
                type: "nvarchar(max)",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AlterColumn<string>(
                name: "Objet",
                table: "Documents",
                type: "nvarchar(max)",
                nullable: false,
                defaultValue: "",
                oldClrType: typeof(string),
                oldType: "nvarchar(max)",
                oldNullable: true);

            migrationBuilder.AddColumn<string>(
                name: "AutoriteRetrait",
                table: "Documents",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Circuit",
                table: "Documents",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "EtapeService",
                table: "Documents",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "JalsatTransaction",
                table: "Documents",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "NumeroBureauOrdre",
                table: "Documents",
                type: "nvarchar(max)",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "TaslimTransaction",
                table: "Documents",
                type: "nvarchar(max)",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "AgentDestinataireId",
                table: "Transactions");

            migrationBuilder.DropColumn(
                name: "CourrierAdminId",
                table: "Transactions");

            migrationBuilder.DropColumn(
                name: "NomPersonneExterne",
                table: "Transactions");

            migrationBuilder.DropColumn(
                name: "ServiceDestinataireId",
                table: "Transactions");

            migrationBuilder.DropColumn(
                name: "StatutEtape",
                table: "Transactions");

            migrationBuilder.DropColumn(
                name: "AutoriteRetrait",
                table: "Documents");

            migrationBuilder.DropColumn(
                name: "Circuit",
                table: "Documents");

            migrationBuilder.DropColumn(
                name: "EtapeService",
                table: "Documents");

            migrationBuilder.DropColumn(
                name: "JalsatTransaction",
                table: "Documents");

            migrationBuilder.DropColumn(
                name: "NumeroBureauOrdre",
                table: "Documents");

            migrationBuilder.DropColumn(
                name: "TaslimTransaction",
                table: "Documents");

            migrationBuilder.AlterColumn<string>(
                name: "Objet",
                table: "Documents",
                type: "nvarchar(max)",
                nullable: true,
                oldClrType: typeof(string),
                oldType: "nvarchar(max)");
        }
    }
}
