{-# LANGUAGE GADTs, DataKinds, KindSignatures #-}
-- explicitly enable the warning that would say the pattern match below is
-- nonexhaustive, to show it does not appear
{-# OPTIONS_GHC -Wincomplete-uni-patterns #-}
module DataKinds where

-- Perhaps this could be a database enum, with the tag of the object, along
-- with an untyped value field
data SettingTag = TOne | TTwo | TThree

-- GADT to staple a type to the return value of the 'decode' function below
data Setting (tag :: SettingTag) where
    SettingOne :: Int -> Setting 'TOne
    SettingTwo :: Bool -> Setting 'TTwo
    SettingThree :: String -> Setting 'TThree

-- Typeclasses are functions from type to value (in this case, the value is a
-- value-level function)
class Decode (tag :: SettingTag) where
    decode :: String -> Setting tag

instance Decode 'TOne where
    decode = SettingOne . read

instance Decode 'TTwo where
    decode = SettingTwo . read

instance Decode 'TThree where
    decode = SettingThree

test :: Int
test = let
    SettingOne a = decode @'TOne "blah"
    in a

