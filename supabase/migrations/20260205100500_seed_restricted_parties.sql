-- Seed data for Restricted Party Lists
INSERT INTO public.restricted_party_lists (source_list, entity_name, country_code, address, remarks)
VALUES 
('BIS_EL', 'Huawei Technologies Co., Ltd.', 'CN', 'Bantian Huawei Base, Shenzhen', 'Entity List - Presumption of denial'),
('BIS_EL', 'ZTE Corporation', 'CN', 'ZTE Plaza, Keji Road South, Shenzhen', 'Entity List'),
('BIS_EL', 'Kaspersky Lab', 'RU', 'Leningradskoe Shosse 39A/2, Moscow', 'Entity List'),
('OFAC_SDN', 'Mega Evil Corp', 'KP', 'Pyongyang Industrial Zone', 'Specially Designated National'),
('BIS_DPL', 'John Doe Smuggler', 'US', '123 Fake St, Miami, FL', 'Denied Privileges until 2030'),
('BIS_EL', 'DJI', 'CN', 'Shenzhen', 'Entity List - Human Rights'),
('BIS_EL', 'Hikvision', 'CN', 'Hangzhou', 'Entity List - Human Rights')
ON CONFLICT DO NOTHING;
