-- Add aes_hts_id to cargo_details if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'cargo_details' AND column_name = 'aes_hts_id') THEN
        ALTER TABLE public.cargo_details ADD COLUMN aes_hts_id UUID REFERENCES public.aes_hts_codes(id) ON DELETE SET NULL;
        -- Create index for performance
        CREATE INDEX IF NOT EXISTS idx_cargo_details_aes_hts_id ON public.cargo_details(aes_hts_id);
    END IF;
END $$;

-- Drop table if exists to ensure schema consistency during development
DROP TABLE IF EXISTS public.global_hs_roots CASCADE;

-- Create global_hs_roots table (WCO HS Nomenclature Roots)
CREATE TABLE public.global_hs_roots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chapter_code TEXT NOT NULL, -- e.g. '01'
    heading_code TEXT, -- e.g. '0101' (nullable for chapter roots)
    description TEXT NOT NULL,
    level TEXT NOT NULL CHECK (level IN ('chapter', 'heading', 'subheading')),
    parent_id UUID REFERENCES public.global_hs_roots(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(chapter_code, heading_code) -- Nulls in unique constraint behave differently in standard SQL but PG treats (val, null) as unique distinct from (val, null) usually? actually multiple nulls are allowed in unique constraint. 
    -- For unique constraint with nulls: (chapter_code, heading_code) where heading_code is null allows multiple rows?
    -- Actually for chapter roots, heading_code is null. 
    -- We want unique chapter_code where heading_code is null.
    -- And unique (chapter_code, heading_code) where heading_code is not null.
    -- PG 15 supports UNIQUE NULLS NOT DISTINCT but let's stick to simple UNIQUE and maybe a partial index if needed.
    -- Or just rely on app logic/seeding. 
    -- Let's use a conditional unique index for chapters.
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_global_hs_roots_chapter ON public.global_hs_roots(chapter_code) WHERE heading_code IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_global_hs_roots_heading ON public.global_hs_roots(chapter_code, heading_code) WHERE heading_code IS NOT NULL;

-- Enable RLS
ALTER TABLE public.global_hs_roots ENABLE ROW LEVEL SECURITY;

-- RLS Policies (Read-only for most, Admin manage)
CREATE POLICY "Public read access" ON public.global_hs_roots FOR SELECT USING (true);
CREATE POLICY "Admin write access" ON public.global_hs_roots FOR ALL USING (is_platform_admin(auth.uid()));

-- Seed WCO Chapters (Sample - Sections I-XVI)
INSERT INTO public.global_hs_roots (chapter_code, level, description)
VALUES
('01', 'chapter', 'Live animals'),
('02', 'chapter', 'Meat and edible meat offal'),
('03', 'chapter', 'Fish and crustaceans, molluscs and other aquatic invertebrates'),
('04', 'chapter', 'Dairy produce; birds eggs; natural honey; edible products of animal origin, not elsewhere specified or included'),
('05', 'chapter', 'Products of animal origin, not elsewhere specified or included'),
('06', 'chapter', 'Live trees and other plants; bulbs, roots and the like; cut flowers and ornamental foliage'),
('07', 'chapter', 'Edible vegetables and certain roots and tubers'),
('08', 'chapter', 'Edible fruit and nuts; peel of citrus fruit or melons'),
('09', 'chapter', 'Coffee, tea, maté and spices'),
('10', 'chapter', 'Cereals'),
('11', 'chapter', 'Products of the milling industry; malt; starches; inulin; wheat gluten'),
('12', 'chapter', 'Oil seeds and oleaginous fruits; miscellaneous grains, seeds and fruit; industrial or medicinal plants; straw and fodder'),
('13', 'chapter', 'Lac; gums, resins and other vegetable saps and extracts'),
('14', 'chapter', 'Vegetable plaiting materials; vegetable products not elsewhere specified or included'),
('15', 'chapter', 'Animal or vegetable fats and oils and their cleavage products; prepared edible fats; animal or vegetable waxes'),
('16', 'chapter', 'Preparations of meat, of fish or of crustaceans, molluscs or other aquatic invertebrates'),
('17', 'chapter', 'Sugars and sugar confectionery'),
('18', 'chapter', 'Cocoa and cocoa preparations'),
('19', 'chapter', 'Preparations of cereals, flour, starch or milk; pastrycooks products'),
('20', 'chapter', 'Preparations of vegetables, fruit, nuts or other parts of plants'),
('21', 'chapter', 'Miscellaneous edible preparations'),
('22', 'chapter', 'Beverages, spirits and vinegar'),
('23', 'chapter', 'Residues and waste from the food industries; prepared animal fodder'),
('24', 'chapter', 'Tobacco and manufactured tobacco substitutes'),
('25', 'chapter', 'Salt; sulphur; earths and stone; plastering materials, lime and cement'),
('26', 'chapter', 'Ores, slag and ash'),
('27', 'chapter', 'Mineral fuels, mineral oils and products of their distillation; bituminous substances; mineral waxes'),
('28', 'chapter', 'Inorganic chemicals; organic or inorganic compounds of precious metals, of rare-earth metals, of radioactive elements or of isotopes'),
('29', 'chapter', 'Organic chemicals'),
('30', 'chapter', 'Pharmaceutical products'),
('31', 'chapter', 'Fertilisers'),
('32', 'chapter', 'Tanning or dyeing extracts; tannins and their derivatives; dyes, pigments and other colouring matter; paints and varnishes; putty and other mastics; inks'),
('33', 'chapter', 'Essential oils and resinoids; perfumery, cosmetic or toilet preparations'),
('34', 'chapter', 'Soap, organic surface-active agents, washing preparations, lubricating preparations, artificial waxes, prepared waxes, polishing or scouring preparations, candles and similar articles, modelling pastes, dental waxes and dental preparations with a basis of plaster'),
('35', 'chapter', 'Albuminoidal substances; modified starches; glues; enzymes'),
('36', 'chapter', 'Explosives; pyrotechnic products; matches; pyrophoric alloys; certain combustible preparations'),
('37', 'chapter', 'Photographic or cinematographic goods'),
('38', 'chapter', 'Miscellaneous chemical products'),
('39', 'chapter', 'Plastics and articles thereof'),
('40', 'chapter', 'Rubber and articles thereof'),
('41', 'chapter', 'Raw hides and skins (other than furskins) and leather'),
('42', 'chapter', 'Articles of leather; saddlery and harness; travel goods, handbags and similar containers; articles of animal gut (other than silkworm gut)'),
('43', 'chapter', 'Furskins and artificial fur; manufactures thereof'),
('44', 'chapter', 'Wood and articles of wood; wood charcoal'),
('45', 'chapter', 'Cork and articles of cork'),
('46', 'chapter', 'Manufactures of straw, of esparto or of other plaiting materials; basketware and wickerwork'),
('47', 'chapter', 'Pulp of wood or of other fibrous cellulosic material; recovered (waste and scrap) paper or paperboard'),
('48', 'chapter', 'Paper and paperboard; articles of paper pulp, of paper or of paperboard'),
('49', 'chapter', 'Printed books, newspapers, pictures and other products of the printing industry; manuscripts, typescripts and plans'),
('50', 'chapter', 'Silk'),
('51', 'chapter', 'Wool, fine or coarse animal hair; horsehair yarn and woven fabric'),
('52', 'chapter', 'Cotton'),
('53', 'chapter', 'Other vegetable textile fibres; paper yarn and woven fabrics of paper yarn'),
('54', 'chapter', 'Man-made filaments; strip and the like of man-made textile materials'),
('55', 'chapter', 'Man-made staple fibres'),
('56', 'chapter', 'Wadding, felt and nonwovens; special yarns; twine, cordage, ropes and cables and articles thereof'),
('57', 'chapter', 'Carpets and other textile floor coverings'),
('58', 'chapter', 'Special woven fabrics; tufted textile fabrics; lace; tapestries; trimmings; embroidery'),
('59', 'chapter', 'Impregnated, coated, covered or laminated textile fabrics; textile articles of a kind suitable for industrial use'),
('60', 'chapter', 'Knitted or crocheted fabrics'),
('61', 'chapter', 'Articles of apparel and clothing accessories, knitted or crocheted'),
('62', 'chapter', 'Articles of apparel and clothing accessories, not knitted or crocheted'),
('63', 'chapter', 'Other made up textile articles; sets; worn clothing and worn textile articles; rags'),
('64', 'chapter', 'Footwear, gaiters and the like; parts of such articles'),
('65', 'chapter', 'Headgear and parts thereof'),
('66', 'chapter', 'Umbrellas, sun umbrellas, walking-sticks, seat-sticks, whips, riding-crops and parts thereof'),
('67', 'chapter', 'Prepared feathers and down and articles made of feathers or of down; artificial flowers; articles of human hair'),
('68', 'chapter', 'Articles of stone, plaster, cement, asbestos, mica or similar materials'),
('69', 'chapter', 'Ceramic products'),
('70', 'chapter', 'Glass and glassware'),
('71', 'chapter', 'Natural or cultured pearls, precious or semi-precious stones, precious metals, metals clad with precious metal, and articles thereof; imitation jewellery; coin'),
('72', 'chapter', 'Iron and steel'),
('73', 'chapter', 'Articles of iron or steel'),
('74', 'chapter', 'Copper and articles thereof'),
('75', 'chapter', 'Nickel and articles thereof'),
('76', 'chapter', 'Aluminium and articles thereof'),
('78', 'chapter', 'Lead and articles thereof'),
('79', 'chapter', 'Zinc and articles thereof'),
('80', 'chapter', 'Tin and articles thereof'),
('81', 'chapter', 'Other base metals; cermets; articles thereof'),
('82', 'chapter', 'Tools, implements, cutlery, spoons and forks, of base metal; parts thereof of base metal'),
('83', 'chapter', 'Miscellaneous articles of base metal'),
('84', 'chapter', 'Nuclear reactors, boilers, machinery and mechanical appliances; parts thereof'),
('85', 'chapter', 'Electrical machinery and equipment and parts thereof; sound recorders and reproducers, television image and sound recorders and reproducers, and parts and accessories of such articles'),
('86', 'chapter', 'Railway or tramway locomotives, rolling-stock and parts thereof; railway or tramway track fixtures and fittings and parts thereof; mechanical (including electro-mechanical) traffic signalling equipment of all kinds'),
('87', 'chapter', 'Vehicles other than railway or tramway rolling-stock, and parts and accessories thereof'),
('88', 'chapter', 'Aircraft, spacecraft, and parts thereof'),
('89', 'chapter', 'Ships, boats and floating structures'),
('90', 'chapter', 'Optical, photographic, cinematographic, measuring, checking, precision, medical or surgical instruments and apparatus; parts and accessories thereof'),
('91', 'chapter', 'Clocks and watches and parts thereof'),
('92', 'chapter', 'Musical instruments; parts and accessories of such articles'),
('93', 'chapter', 'Arms and ammunition; parts and accessories thereof'),
('94', 'chapter', 'Furniture; bedding, mattresses, mattress supports, cushions and similar stuffed furnishings; lamps and lighting fittings, not elsewhere specified or included; illuminated signs, illuminated name-plates and the like; prefabricated buildings'),
('95', 'chapter', 'Toys, games and sports requisites; parts and accessories thereof'),
('96', 'chapter', 'Miscellaneous manufactured articles'),
('97', 'chapter', 'Works of art, collectors pieces and antiques')
ON CONFLICT (chapter_code) WHERE heading_code IS NULL DO NOTHING;
