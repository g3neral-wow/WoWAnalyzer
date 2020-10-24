import React from 'react';

import SPELLS from 'common/SPELLS';
import { formatNumber } from 'common/format';
import Statistic from 'interface/statistics/Statistic';
import STATISTIC_CATEGORY from 'interface/others/STATISTIC_CATEGORY';
import BoringSpellValueText from 'interface/statistics/components/BoringSpellValueText';
import SpellLink from 'common/SpellLink';
import Analyzer, { Options, SELECTED_PLAYER, SELECTED_PLAYER_PET } from 'parser/core/Analyzer';
import Events, {CastEvent, HealEvent, DeathEvent, ApplyBuffEvent, RemoveBuffEvent } from 'parser/core/Events';
import calculateEffectiveHealing from 'parser/core/calculateEffectiveHealing';
import Combatants from 'parser/shared/modules/Combatants';
import { ThresholdStyle, When } from 'parser/core/ParseResults';
import { i18n } from '@lingui/core';
import { t } from '@lingui/macro';

const ENVELOPING_BREATH_INCREASE = .1;
const debug: boolean = false;

class EnvelopingBreath extends Analyzer {
    static dependencies = {
        combatants: Combatants,
      };

    protected combatants!: Combatants;
    
    envsDuringCelestial: number = 0;
    envBreathsApplied: number = 0;
    celestialActive: boolean = false;  
    envBIncrease: number = 0;

    constructor(options: Options) {
        super(options);
        this.addEventListener(Events.heal.by(SELECTED_PLAYER), this.handleEnvelopingBreathHeal);
        this.addEventListener(Events.applybuff.by(SELECTED_PLAYER).spell(SPELLS.ENVELOPING_BREATH), this.handleEnvelopingBreathCount);
        this.addEventListener(Events.cast.by(SELECTED_PLAYER).spell(SPELLS.ENVELOPING_MIST), this.handleEnvelopingMist);
        if(this.selectedCombatant.hasTalent(SPELLS.INVOKE_CHIJI_THE_RED_CRANE_TALENT)){
          this.addEventListener(Events.death.to(SELECTED_PLAYER_PET), this.handleChijiDeath);
          this.addEventListener(Events.cast.by(SELECTED_PLAYER).spell(SPELLS.INVOKE_CHIJI_THE_RED_CRANE_TALENT), this.handleCelestialSummon);
        } else {
          this.addEventListener(Events.cast.by(SELECTED_PLAYER).spell(SPELLS.INVOKE_YULON_THE_JADE_SERPENT), this.handleCelestialSummon);
          this.addEventListener(Events.removebuff.by(SELECTED_PLAYER).spell(SPELLS.INVOKE_YULON_THE_JADE_SERPENT), this.handleYulonEnd);

        }
    }
    
  handleEnvelopingBreathHeal(event: HealEvent) {
    const targetId = event.targetID;
    const sourceId = event.sourceID;
    
    if (this.combatants.players[targetId]) {
      if (this.combatants.players[targetId].hasBuff(SPELLS.ENVELOPING_BREATH.id, event.timestamp, 0, 0, sourceId)) {
        this.envBIncrease += calculateEffectiveHealing(event, ENVELOPING_BREATH_INCREASE);
      }
    }
  }

  handleEnvelopingMist(event: CastEvent) {
    if(this.celestialActive) {
      this.envsDuringCelestial += 1;
    }
  }

  handleEnvelopingBreathCount(event: ApplyBuffEvent) {
    if(this.celestialActive) {
      this.envBreathsApplied += 1;
    }
  }

  handleCelestialSummon(event: CastEvent) { 
    this.celestialActive = true;
    debug && console.log("Yulon/Chiji summoned");
  }

  handleChijiDeath(event: DeathEvent) {
    this.celestialActive = false;
    debug && console.log("Chiji Died");
  }

  handleYulonEnd(event: RemoveBuffEvent) {
    this.celestialActive = false;
    debug && console.log("Yulon Died");
  }

  get averageEnvBPerEnv() {
    return this.envBreathsApplied / this.envsDuringCelestial || 0;
  }

  get suggestionThresholds() {
    return {
      actual: this.averageEnvBPerEnv,
      isLessThan: {
        minor: 5,
        average: 4,
        major: 3,
      },
      style: ThresholdStyle.NUMBER,
    };
  }

  suggestions(when: When) {
    when(this.suggestionThresholds).addSuggestion((suggest, actual, recommended) => suggest(
          <>
            You are not utilizing <SpellLink id={SPELLS.ENVELOPING_BREATH.id} /> effectively. Make sure you are choosing good targets for your <SpellLink id={SPELLS.ENVELOPING_MIST.id} /> during your Celestial cooldowns to apply the maximum number of <SpellLink id={SPELLS.ENVELOPING_BREATH.id} /> possible.
          </>,
        )
          .icon(SPELLS.ENVELOPING_BREATH.icon)
          .actual(`${this.averageEnvBPerEnv.toFixed(2)}${i18n._(t('monk.mistweaver.suggestions.envelopingBreath.averageEnvBPerEnv')` Enveloping Breaths per Enveloping Mist during Celestial`)}`)
          .recommended(`${recommended} Enveloping Breaths are recommended per cast`));
  }

  statistic() {
      return (
        <Statistic
        size="flexible"
        category={STATISTIC_CATEGORY.GENERAL}
        tooltip={<>This is the effective healing contributed by the Enveloping Breath buff.</>}
      >
        <BoringSpellValueText spell={SPELLS.ENVELOPING_BREATH}>
          <>
            {formatNumber(this.envBIncrease)} <small>healing contributed by the buff</small>
          </>
        </BoringSpellValueText>
      </Statistic>
      );
  }


}

export default EnvelopingBreath;