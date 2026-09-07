using WebApplication1.Helpers;
using WebApplication1.Models;
using Xunit;

namespace WebApplication1.Tests
{
    public class ServiceMapperTests
    {
        [Theory]
        [InlineData("bureauordre", ServiceTribunal.BureauOrdre)]
        [InlineData("fathmilafat", ServiceTribunal.OuvertureDossier)]
        [InlineData("secretarait", ServiceTribunal.KitabaKhasa)]
        [InlineData("seances&procedures", ServiceTribunal.JalsatWaIjra2at)]
        [InlineData("khibra", ServiceTribunal.Khibra)]
        [InlineData("taslimnosakh", ServiceTribunal.TaslimNusakh)]
        [InlineData("tasfiatSawa2irTakmilia", ServiceTribunal.TasfiyatSawa2ir)]
        [InlineData("archive", ServiceTribunal.Archive)]
        [InlineData("atabligh", ServiceTribunal.Tabligh)]
        public void RbacServiceCodes_MapTo_CorrectServiceTribunal(string code, ServiceTribunal expected)
        {
            Assert.Equal(expected, ServiceMapper.MapToServiceEnum(code));
        }

        [Theory]
        [InlineData("BureauOrdre")]
        [InlineData("Archive")]
        [InlineData("Khibra")]
        public void EnumNames_AreParsedCaseInsensitively(string enumName)
        {
            var result = ServiceMapper.MapToServiceEnum(enumName);
            Assert.Equal(Enum.Parse<ServiceTribunal>(enumName, ignoreCase: true), result);
        }

        [Theory]
        [InlineData("Bureau d'ordre et bureau administratif", ServiceTribunal.BureauOrdre)]
        [InlineData("Bureau de Gestion des Dossiers Judiciaires", ServiceTribunal.OuvertureDossier)]
        public void LegacyFrenchNames_StillMap(string name, ServiceTribunal expected)
        {
            Assert.Equal(expected, ServiceMapper.MapToServiceEnum(name));
        }

        [Fact]
        public void UnknownCode_FallsBackToBureauOrdre()
        {
            Assert.Equal(ServiceTribunal.BureauOrdre, ServiceMapper.MapToServiceEnum("service_inconnu"));
        }
    }
}
