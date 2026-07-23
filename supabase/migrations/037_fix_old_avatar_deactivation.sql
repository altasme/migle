-- 036 only deactivated av_male_hoodie_01/02/03, av_male_dark_01/02/03,
-- av_female_pink_01/02/03 (9 rows) by hardcoded id list - it wrongly
-- assumed 3 variants per old style. The actual seed (003) has 16 variants
-- per style, so _04 through _16 of each (39 rows) stayed active and kept
-- showing as extra "Street"/"Shadow"/"Sakura" sub-categories alongside the
-- new av_male/av_female catalog. Pattern-matched this time instead of a
-- hardcoded list, so an undercount like that can't happen again.
update cosmetic_items set is_active = false
 where slot = 'body'
   and (
     id like 'av_male_hoodie_%'
     or id like 'av_male_dark_%'
     or id like 'av_female_pink_%'
   );
