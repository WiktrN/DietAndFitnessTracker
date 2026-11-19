using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace NutriTrack.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddRecipeSectionsAndInstructions : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Instructions",
                table: "Recipes",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "SectionName",
                table: "Ingredients",
                type: "TEXT",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Instructions",
                table: "Recipes");

            migrationBuilder.DropColumn(
                name: "SectionName",
                table: "Ingredients");
        }
    }
}
