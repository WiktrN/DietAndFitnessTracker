using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace NutriTrack.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddMuscleGroupAndCardio : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "ExerciseType",
                table: "WorkoutTemplateExercises",
                type: "TEXT",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "MuscleGroup",
                table: "WorkoutTemplateExercises",
                type: "TEXT",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "ExerciseType",
                table: "ExerciseSetLogs",
                type: "TEXT",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "MuscleGroup",
                table: "ExerciseSetLogs",
                type: "TEXT",
                nullable: false,
                defaultValue: "");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ExerciseType",
                table: "WorkoutTemplateExercises");

            migrationBuilder.DropColumn(
                name: "MuscleGroup",
                table: "WorkoutTemplateExercises");

            migrationBuilder.DropColumn(
                name: "ExerciseType",
                table: "ExerciseSetLogs");

            migrationBuilder.DropColumn(
                name: "MuscleGroup",
                table: "ExerciseSetLogs");
        }
    }
}
