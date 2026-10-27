import 'server-only';

import { containsProfanity } from '@/lib/profanity';
import wordList from './word-list.json';
import scowlWordList from './scowl-word-list.json';
import additionalWordGroups from './daily-word-groups.json';

/**
 * The offline guess set combines the filtered Webster's Second International
 * list with additional words from the SCOWL 70 American English list. The
 * source and license details are in `word-list-sources.md`. Entries contain
 * five lowercase letters with no repeats; the server still applies these
 * checks before accepting a guess.
 */
export const WORD_DICTIONARY = new Set<string>([...wordList, ...scowlWordList.words]);

export function isValidWord(value: string): boolean {
  const word = value.trim().toLowerCase();
  return /^[a-z]{5}$/.test(word) &&
    new Set(word).size === 5 &&
    WORD_DICTIONARY.has(word) &&
    !containsProfanity(word);
}

const ANSWER_CANDIDATES = [
  ['about', 'A word used when discussing a topic.'],
  ['above', 'Look up to find this word.'],
  ['actor', 'A performer who takes a role on stage or screen.'],
  ['acute', 'A word that can describe a sharp angle.'],
  ['admit', 'To acknowledge that something is true.'],
  ['adopt', 'To take on or make something your own.'],
  ['after', 'The time that comes later.'],
  ['agent', 'A person who acts for someone else.'],
  ['agile', 'Able to move quickly and easily.'],
  ['alert', 'Ready to notice what is happening.'],
  ['alien', 'A visitor from somewhere beyond Earth.'],
  ['align', 'To arrange things in a straight line.'],
  ['alive', 'Still living.'],
  ['alter', 'To make a change.'],
  ['angel', 'A heavenly messenger in many old tales.'],
  ['anger', 'A strong feeling of displeasure.'],
  ['angle', 'The space where two lines meet.'],
  ['argue', 'To give reasons for a point of view.'],
  ['arise', 'To come into view or begin.'],
  ['aroma', 'A noticeable smell, often a pleasant one.'],
  ['aside', 'Away from the main place or subject.'],
  ['audio', 'Sound that can be heard or recorded.'],
  ['audit', 'A careful check of records.'],
  ['avoid', 'To keep clear of something.'],
  ['bacon', 'A salty breakfast food.'],
  ['badge', 'A small sign worn to show a role or group.'],
  ['baker', 'A person who makes bread and cakes.'],
  ['basic', 'A simple starting point.'],
  ['basin', 'A bowl-shaped vessel or low area of land.'],
  ['batch', 'A group made or handled together.'],
  ['beach', 'A sandy or pebbly edge beside the sea.'],
  ['beard', 'Hair that grows on a chin.'],
  ['beast', 'A large or wild animal.'],
  ['began', 'A past-tense word for starting.'],
  ['begin', 'To start.'],
  ['being', 'A living creature or a state of existence.'],
  ['below', 'In a lower place.'],
  ['bench', 'A long seat for more than one person.'],
  ['black', 'The darkest color.'],
  ['blade', 'The sharp, flat part of a knife or tool.'],
  ['blame', 'To say who is responsible for a fault.'],
  ['blank', 'Empty, with nothing written on it.'],
  ['blast', 'A sudden strong burst of air or sound.'],
  ['blaze', 'A bright, strong fire.'],
  ['bleak', 'Bare, cold, or without much hope.'],
  ['blend', 'To mix things together.'],
  ['blind', 'Unable to see.'],
  ['blink', 'To close and open the eyes quickly.'],
  ['block', 'A solid piece or an obstacle.'],
  ['blond', 'A light yellow hair color.'],
  ['blown', 'Moved by a current of air.'],
  ['blues', 'A family of colors between green and violet.'],
  ['blunt', 'Not sharp at the point or edge.'],
  ['board', 'A flat piece of wood.'],
  ['boast', 'To speak with too much pride.'],
  ['bonus', 'Something extra.'],
  ['bound', 'Tied or held in place.'],
  ['boxer', 'A person who fights in a ring.'],
  ['brake', 'A device that slows a vehicle.'],
  ['brand', 'A name used to identify a maker or product.'],
  ['brave', 'Ready to face danger or difficulty.'],
  ['bread', 'A baked food made from flour.'],
  ['break', 'To separate into pieces.'],
  ['brick', 'A block used to build walls.'],
  ['bride', 'A person on their wedding day.'],
  ['brief', 'Short in time or length.'],
  ['bring', 'To carry something toward a place.'],
  ['broad', 'Wide from side to side.'],
  ['broke', 'Past tense of breaking.'],
  ['brown', 'A color like earth or tree bark.'],
  ['brush', 'A tool with bristles for cleaning or painting.'],
  ['build', 'To make something by putting parts together.'],
  ['built', 'Made by putting parts together.'],
  ['burst', 'To break open suddenly.'],
  ['buyer', 'A person who purchases something.'],
  ['cabin', 'A small, simple house or shelter.'],
  ['cable', 'A thick wire used to carry power or information.'],
  ['camel', 'A desert animal with a hump.'],
  ['canal', 'A man-made waterway.'],
  ['candy', 'A sweet treat.'],
  ['cargo', 'Goods carried by a ship, plane, or truck.'],
  ['catch', 'To stop and hold something moving through the air.'],
  ['cause', 'A reason something happens.'],
  ['cedar', 'An evergreen tree with fragrant wood.'],
  ['chain', 'A series of linked metal rings.'],
  ['chair', 'A seat with a back.'],
  ['chalk', 'A soft stick used for writing on a board.'],
  ['champ', 'A winner.'],
  ['charm', 'A small object believed to bring good luck.'],
  ['chart', 'A drawing that presents information.'],
  ['chase', 'To run after something.'],
  ['cheap', 'Low in price.'],
  ['chest', 'A strong box or the front of the upper body.'],
  ['chief', 'The person in charge.'],
  ['child', 'A young person.'],
  ['choir', 'A group that sings together.'],
  ['civil', 'Polite and respectful.'],
  ['claim', 'To say that something is true or belongs to you.'],
  ['clamp', 'A tool that holds things tightly together.'],
  ['clean', 'Free from dirt.'],
  ['clear', 'Easy to see through or understand.'],
  ['clerk', 'A person who keeps records or helps customers.'],
  ['click', 'A short, sharp sound or a mouse-button press.'],
  ['climb', 'To go upward using hands or feet.'],
  ['clock', 'A device that tells the time.'],
  ['clone', 'A copy made from an original.'],
  ['close', 'Near in distance.'],
  ['cloth', 'Woven material used to make clothes.'],
  ['cloud', 'A visible mass of water droplets in the sky.'],
  ['coach', 'A person who trains a team or learner.'],
  ['coast', 'Land beside the sea.'],
  ['coral', 'A sea animal that builds hard reefs.'],
  ['count', 'To find the number of things.'],
  ['court', 'A place where a judge hears cases.'],
  ['cover', 'To place something over another thing.'],
  ['craft', 'A skill in making things by hand.'],
  ['crane', 'A tall machine used to lift heavy loads.'],
  ['crash', 'A sudden collision.'],
  ['crate', 'A strong box for carrying goods.'],
  ['crawl', 'To move slowly close to the ground.'],
  ['crazy', 'Wild or very unusual.'],
  ['cream', 'A rich part of milk or a soft lotion.'],
  ['credo', 'A statement of belief.'],
  ['crest', 'The top or highest point.'],
  ['crime', 'An act forbidden by law.'],
  ['crisp', 'Firm and pleasantly crunchy.'],
  ['cross', 'To move from one side to another.'],
  ['crowd', 'A large group of people.'],
  ['crown', 'A decorated headpiece worn by a ruler.'],
  ['crude', 'Rough or not yet refined.'],
  ['crush', 'To press until something is damaged.'],
  ['curve', 'A line that bends instead of going straight.'],
  ['cycle', 'A series of events that repeats.'],
] as const;

const ADDITIONAL_ANSWER_CANDIDATES = additionalWordGroups.flatMap(({ hint, words }) =>
  words.map((word) => [word, hint] as const),
);

const seenAnswers = new Set<string>();
export const DAILY_WORDS = [...ANSWER_CANDIDATES, ...ADDITIONAL_ANSWER_CANDIDATES]
  .filter(([word]) => isValidWord(word))
  .filter(([word]) => {
    if (seenAnswers.has(word)) return false;
    seenAnswers.add(word);
    return true;
  })
  .map(([word, hint]) => ({ word, hint }));

if (DAILY_WORDS.length < 400) {
  throw new Error(`Letter Ledger needs at least 400 daily answers; found ${DAILY_WORDS.length}.`);
}
