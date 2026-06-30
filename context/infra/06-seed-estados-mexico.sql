-- =====================================================================
-- SCRIPT 6: SEED DE ESTADOS DE MÉXICO (32 entidades federativas)
-- =====================================================================
-- FIX-20260624-08 — Bug B (catálogo vacío en /solicitar-alta)
--
-- Problema:
--   La tabla `estados_mexico` fue creada por la migración `20260623170000`
--   pero nunca se pobló con los 32 estados. `listEstadosMexico()` retornaba
--   [] y el <select> de "Estado *" solo tenía la opción "Seleccionar…".
--
-- Solución:
--   INSERT idempotente de las 32 entidades federativas (catálogo INEGI) con
--   sus municipios principales. Si el registro ya existe (mismo id), se
--   actualizan `nombre` y `municipios` para mantener el catálogo sincronizado.
--
-- Fuente:
--   INEGI — Marco Geoestadístico Nacional (claves 01..32).
--   Municipios: principales cabeceras municipales por estado; se incluyen
--   los más relevantes para clientes industriales (manufactura, logística,
--   servicios, parques industriales).
--
-- Aplicación:
--   Idempotente. Seguro de correr múltiples veces. Se invoca desde la nueva
--   sección 5 de `context/infra/apply-migrations.ts` (solo si la tabla tiene
--   0 registros; si ya tiene datos, hace UPDATE vía ON CONFLICT).
-- =====================================================================

-- 32 entidades federativas de México con sus municipios principales
INSERT INTO "estados_mexico" ("id", "nombre", "municipios") VALUES
  (1,  'Aguascalientes', ARRAY['Aguascalientes','Calvillo','Jesús María','Pabellón de Arteaga','Rincón de Romos','San Francisco de los Romo','Asientos','Cosío','San José de Gracia','Tepezalá','El Llano','San Ignacio']),
  (2,  'Baja California', ARRAY['Tijuana','Mexicali','Ensenada','Rosarito','Tecate','Playas de Rosarito','San Quintín','San Felipe']),
  (3,  'Baja California Sur', ARRAY['La Paz','Los Cabos','San José del Cabo','Cabo San Lucas','Comondú','Loreto','Mulegé','Santa Rosalía']),
  (4,  'Campeche', ARRAY['Campeche','Ciudad del Carmen','Champotón','Escárcega','Calkiní','Hecelchakán','Hopelchén','Tenabo','Calakmul','Candelaria']),
  (5,  'Coahuila de Zaragoza', ARRAY['Saltillo','Torreón','Monclova','Piedras Negras','Acuña','Sabinas','Múzquiz','Frontera','Matamoros','Parras de la Fuente','San Pedro','Nava','Allende','Ramos Arizpe','Castaños']),
  (6,  'Colima', ARRAY['Colima','Manzanillo','Tecomán','Villa de Álvarez','Armería','Coquimatlán','Comala','Cuauhtémoc','Ixtlahuacán','Minatitlán']),
  (7,  'Chiapas', ARRAY['Tuxtla Gutiérrez','San Cristóbal de las Casas','Tapachula','Comitán de Domínguez','Palenque','Cintalapa','Tonala','Chiapa de Corzo','Ocosingo','Villaflores','Motozintla','Las Margaritas','Huixtla','Pijijiapan','Arriaga']),
  (8,  'Chihuahua', ARRAY['Chihuahua','Ciudad Juárez','Delicias','Cuauhtémoc','Hidalgo del Parral','Camargo','Jiménez','Nuevo Casas Grandes','Ojinaga','Meoqui','Saucillo','Bocoyna','Guachochi','Madera','Creel','Casas Grandes']),
  (9,  'Ciudad de México', ARRAY['Álvaro Obregón','Azcapotzalco','Benito Juárez','Coyoacán','Cuajimalpa de Morelos','Cuauhtémoc','Gustavo A. Madero','Iztacalco','Iztapalapa','La Magdalena Contreras','Miguel Hidalgo','Milpa Alta','Tláhuac','Tlalpan','Venustiano Carranza','Xochimilco']),
  (10, 'Durango', ARRAY['Durango','Gómez Palacio','Lerdo','Santiago Papasquiaro','Vicente Guerrero','El Salto','Canatlán','Cuencamé','Mapimí','Mezquital','Nombre de Dios','Nuevo Ideal','Poanas','Pueblo Nuevo','San Juan del Río','Tlahualilo']),
  (11, 'Guanajuato', ARRAY['Guanajuato','León','Irapuato','Celaya','Salamanca','Silao','San Miguel de Allende','San Luis de la Paz','Dolores Hidalgo','Acámbaro','Moroleón','Uriangato','Pénjamo','Salamanca','Cortazar','Juventino Rosas','Romita','San Francisco del Rincón','Purísima del Rincón','Valle de Santiago','Yuriria','Apaseo el Alto','Apaseo el Grande','Comonfort','Villagrán']),
  (12, 'Guerrero', ARRAY['Chilpancingo de los Bravo','Acapulco de Juárez','Iguala de la Independencia','Zihuatanejo de Azueta','Taxco de Alarcón','Tlapa de Comonfort','Chilapa de Álvarez','Ometepec','Ayutla de los Libres','Petatlán','Coyuca de Benítez','San Luis Acatlán','Tecpan de Galeana','Atoyac de Álvarez','Arcelia','Teloloapan']),
  (13, 'Hidalgo', ARRAY['Pachuca de Soto','Mineral de la Reforma','Tulancingo','Tizayuca','Huejutla de Reyes','Ixmiquilpan','Actopan','Tepeji del Río de Ocampo','Apan','Mixquiahuala de Juárez','Cuautepec de Hinojosa','Santiago de Anaya','Tula de Allende','Tepeapulco','Zimapán','Molango','Huichapan','Tecozautla']),
  (14, 'Jalisco', ARRAY['Guadalajara','Zapopan','Tlaquepaque','Tonalá','Puerto Vallarta','Tlajomulco de Zúñiga','El Salto','Lagos de Moreno','Tepatitlán de Morelos','Arandas','Atotonilco el Alto','Autlán de Navarro','Ameca','Ahualulco de Mercado','Chapala','Jocotepec','La Barca','Ocotlán','Poncitlán','San Juan de los Lagos','San Miguel el Alto','Tequila','Villa Hidalgo','Zacoalco de Torres','Zapotlán el Grande','Zapotlanejo']),
  (15, 'México', ARRAY['Toluca','Ecatepec de Morelos','Naucalpan de Juárez','Tlalnepantla de Baz','Nezahualcóyotl','Cuautitlán Izcalli','Chimalhuacán','Atizapán de Zaragoza','Huixquilucan','Metepec','Lerma','Zinacantepec','San Mateo Atenco','Texcoco','Chalco','Ixtapaluca','Tecámac','Tultitlán','Coacalco de Berriozábal','Cuautitlán','Valle de Chalco Solidaridad','La Paz','Nicolás Romero','Teotihuacán','Acolman','Huehuetoca','Tecamac','Zumpango','Jilotepec','Ixtlahuaca','Atlacomulco','San Felipe del Progreso','Jiquipilco','Tenancingo','Tenango del Valle','Calimaya','Almoloya de Juárez','Xonacatlán','Ocoyoacac','Tianguistenco','Capulhuac']),
  (16, 'Michoacán de Ocampo', ARRAY['Morelia','Uruapan','Lázaro Cárdenas','Zamora','Apatzingán','La Piedad','Sahuayo','Jacona','Zitácuaro','Maravatío','Pátzcuaro','Tacámbaro','Puruándiro','Huetamo','Coalcomán de Vázquez Pallares','Jiquilpan','Yurécuaro','La Barca','Múgica','Los Reyes']),
  (17, 'Morelos', ARRAY['Cuernavaca','Jiutepec','Temixco','Cuautla','Yautepec','Emiliano Zapata','Xochitepec','Ayala','Yautepec','Puente de Ixtla','Jojutla','Zacatepec','Tlaquiltenango','Tepoztlán','Huitzilac','Ocotepec','Tetela del Volcán','Yecapixtla','Atlatlahucan','Axochiapan']),
  (18, 'Nayarit', ARRAY['Tepic','Bahía de Banderas','Santiago Ixcuintla','Compostela','San Blas','Tecuala','Acaponeta','Ixtlán del Río','Ruíz','Rosamorada','Xalisco','Túxpam']),
  (19, 'Nuevo León', ARRAY['Monterrey','Guadalupe','San Nicolás de los Garza','Apodaca','General Escobedo','Santa Catarina','San Pedro Garza García','Juárez','Cadereyta Jiménez','Linares','Montemorelos','Santiago','Allende','Galeana','Doctor Arroyo','Hualahuises','Sabinas Hidalgo','Villaldama','Anáhuac','Bustamante','Cerralvo','China','Doctor Coss','García','General Zuazua','Hidalgo','Iturbide','Lampazos de Naranjo','Mina','Parás','Pesquería','Rayones','Salinas Victoria']),
  (20, 'Oaxaca', ARRAY['Oaxaca de Juárez','San Juan Bautista Tuxtepec','Heroica Ciudad de Huajuapan de León','Santiago Pinotepa Nacional','San Pedro Pochutla','Miahuatlán de Porfirio Díaz','Santo Domingo Tehuantepec','Juchitán de Zaragoza','Salina Cruz','Loma Bonita','Ciudad Ixtepec','Putla Villa de Guerrero','Tlaxiaco','Zimatlán de Álvarez','Villa de Zaachila','San Antonio de la Cal','San Agustín de las Juntas','San Sebastián Tutla']),
  (21, 'Puebla', ARRAY['Puebla','Tehuacán','Cholula','Atlixco','San Martín Texmelucan','San Pedro Cholula','Amozoc','Huauchinango','Teziutlán','Xicotepec','Izúcar de Matamoros','Acatlán de Osorio','Tecamachalco','Zacatlán','Chignahuapan','Cuautlancingo','Coronango','Ocoyucan','San Andrés Cholula','Cuapiaxtla de Madero','Palmar de Bravo','Quecholac','Los Reyes de Juárez','Acatzingo','San Salvador El Seco']),
  (22, 'Querétaro', ARRAY['Santiago de Querétaro','San Juan del Río','Corregidora','El Marqués','Querétaro','Pedro Escobedo','Tequisquiapan','San Joaquín','Cadereyta de Montes','Ezequiel Montes','Colón','Huimilpan','Amealco de Bonfil','Pinal de Amoles','Landa de Matamoros','Arroyo Seco','Tolimán']),
  (23, 'Quintana Roo', ARRAY['Benito Juárez','Cancún','Solidaridad','Playa del Carmen','Cozumel','Tulum','Felipe Carrillo Puerto','José María Morelos','Lázaro Cárdenas','Bacalar','Isla Mujeres','Puerto Morelos','Othón P. Blanco','Chetumal']),
  (24, 'San Luis Potosí', ARRAY['San Luis Potosí','Soledad de Graciano Sánchez','Matehuala','Ciudad Valles','Tamazunchale','Rioverde','Cerro de San Pedro','Mexquitic de Carmona','Villa de Reyes','Salinas','Santo Domingo','Cárdenas','Tamuín','Ebano','Tamazunchale','Xilitla','Aquismón','Tancanhuitz','Axtla de Terrazas','Matlapa','Ciudad Fernández']),
  (25, 'Sinaloa', ARRAY['Culiacán','Mazatlán','Ahome','Los Mochis','Guasave','Navolato','El Fuerte','Angostura','Salvador Alvarado','Escuinapa','Rosario','Cosalá','Badiraguato','Choix','Sinaloa de Leyva','Mocorito','San Ignacio','Concordia']),
  (26, 'Sonora', ARRAY['Hermosillo','Cajeme','Ciudad Obregón','Nogales','San Luis Río Colorado','Guaymas','Empalme','Navojoa','Puerto Peñasco','Agua Prieta','Cananea','Caborca','Huatabampo','Etchojoa','Benito Juárez','Bácum','San Ignacio Río Muerto','Álamos','Yécora','Sahuaripa','Moctezuma','Villa Hidalgo','Trincheras','Altar','Pitiquito','General Plutarco Elías Calles','Puerto Libertad']),
  (27, 'Tabasco', ARRAY['Centro','Villahermosa','Cárdenas','Comalcalco','Huimanguillo','Macuspana','Cunduacán','Paraíso','Jalpa de Méndez','Nacajuca','Balancán','Tenosique','Teapa','Tacotalpa','Jalapa','Centla','Emiliano Zapata','Jonuta']),
  (28, 'Tampaulipas', ARRAY['Tampico','Ciudad Victoria','Reynosa','Matamoros','Nuevo Laredo','Madero','Altamira','Mante','González','San Fernando','Soto la Marina','Aldama','Jaumave','Tula','Palmillas','Jaumave','Xicoténcatl','Güémez','Casas','Abasolo','Burgos','Cruillas','Guerrero','Hidalgo','Mainero','Méndez','Miquihuana','Ocampo','San Carlos','San Nicolás','Villagrán']),
  (29, 'Tlaxcala', ARRAY['Tlaxcala','Apizaco','Huamantla','Tlaxco','Chiautempan','San Pablo del Monte','Zacatelco','Santa Ana Chiautempan','Contla de Juan Cuamatzi','Papalotla de Xicohténcatl','La Magdalena Tlaltelulco','Tetla de la Solidaridad','Ixtacuixtla de Mariano Matamoros','Calpulalpan','Nanacamilpa de Mariano Arista','Xaloztoc','Yauhquemehcan','Teolocholco','Acuamanala','Mazatecochco']),
  (30, 'Veracruz de Ignacio de la Llave', ARRAY['Xalapa','Veracruz','Boca del Río','Coatzacoalcos','Córdoba','Orizaba','Poza Rica de Hidalgo','Tuxpan','Minatitlán','San Andrés Tuxtla','Tierra Blanca','Cosamaloapan','Alvarado','Acayucan','Nogales','Camerino Z. Mendoza','Río Blanco','Huatusco','Coscomatepec','Fortín de las Flores','Ixtaczoquitlán','Naranjal','Amatlán de los Reyes','Yanga','Cuitláhuac','Carlos A. Carrillo','Cosoleacaque','Jáltipan','Las Choapas','Agua Dulce','Nanchital','Ixhuatlán del Sureste','Pánuco','Tempoal','Chicontepec','Álamo Temapache','Tantoyuca','Platón Sánchez','Huejutla de Reyes','Chalma','Tamalín']),
  (31, 'Yucatán', ARRAY['Mérida','Kanasín','Umán','Progreso','Valladolid','Tizimín','Motul','Ticul','Oxkutzcab','Tekax','Peto','Izamal','Hunucmá','Chemax','Temozón','Buctzotz','Conkal','Acanceh','Tecoh','Seyé','Uayma','Cuzamá','Homún','Hocabá','Sotuta','Maxcanú','Halachó','Opichén','Muna','Abalá','Celestún']),
  (32, 'Zacatecas', ARRAY['Zacatecas','Guadalupe','Fresnillo','Jerez','Río Grande','Villa de Cos','Loreto','Ojocaliente','Calera','Tlaltenango de Sánchez Román','Nochistlán de Mejía','Jalpa','Apozol','Huanusco','Tabasco','Villanueva','Trancoso','Genaro Codina','Cuauhtémoc','Pinos','Villa Hidalgo','Pánfilo Natera','Villa González Ortega','Noria de Ángeles','Villa García'])
ON CONFLICT ("id") DO UPDATE SET
  "nombre"    = EXCLUDED."nombre",
  "municipios" = EXCLUDED."municipios";

-- Verificación final
SELECT
  COUNT(*) AS "total_estados",
  COUNT(*) FILTER (WHERE array_length("municipios", 1) > 0) AS "estados_con_municipios"
FROM "estados_mexico";