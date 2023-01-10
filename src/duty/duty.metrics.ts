import { LOGGER_PROVIDER } from '@lido-nestjs/logger';
import { Inject, Injectable, LoggerService } from '@nestjs/common';

import { ConfigService } from 'common/config';
import { ConsensusProviderService } from 'common/eth-providers';
import { PrometheusService, TrackTask } from 'common/prometheus';

import { ClickhouseService } from '../storage';
import { AttestationMetrics } from './attestation';
import { ProposeMetrics } from './propose';
import { StateMetrics } from './state';
import { SummaryMetrics } from './summary';
import { SyncMetrics } from './sync';

@Injectable()
export class DutyMetrics {
  public constructor(
    @Inject(LOGGER_PROVIDER) protected readonly logger: LoggerService,
    protected readonly config: ConfigService,
    protected readonly prometheus: PrometheusService,
    protected readonly clClient: ConsensusProviderService,

    protected readonly stateMetrics: StateMetrics,
    protected readonly attestationMetrics: AttestationMetrics,
    protected readonly proposeMetrics: ProposeMetrics,
    protected readonly syncMetrics: SyncMetrics,
    protected readonly summaryMetrics: SummaryMetrics,
    protected readonly storage: ClickhouseService,
  ) {}

  @TrackTask('calc-all-duties-metrics')
  public async calculate(epoch: bigint, possibleHighRewardValidators: string[]): Promise<any> {
    this.logger.log('Calculating duties metrics of user validators');
    await Promise.all([this.withPossibleHighReward(epoch, possibleHighRewardValidators), this.stateMetrics.calculate(epoch)]);
    // we must calculate summary metrics after all duties to avoid errors in processing
    await this.summaryMetrics.calculate(epoch);
    await this.storage.updateEpochProcessing({ epoch, is_calculated: true });
  }

  private async withPossibleHighReward(epoch: bigint, possibleHighRewardValidators: string[]): Promise<void> {
    await Promise.all([
      this.attestationMetrics.calculate(epoch, possibleHighRewardValidators),
      this.proposeMetrics.calculate(epoch, possibleHighRewardValidators),
      this.syncMetrics.calculate(epoch, possibleHighRewardValidators),
    ]);
  }
}
