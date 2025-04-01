import type {
  API,
  FinalizedEvent,
  IncomingEvent,
  NewBlockEvent,
  NewTransactionEvent,
  OutputAPI,
} from "../types"


type txType = {
  transaction: string,
  isValid: boolean
  blockHash: string
}

type blockType = {
  blockHash: string,
  parent: string
}
export default function tsolman(api: API, outputApi: OutputAPI) {

  const currentTransactions: txType[] = []
  const pastBlocks: blockType[] = []


  // Requirements:
  //
  // 1) When a transaction becomes "settled"-which always occurs upon receiving a "newBlock" event-
  //    you must call `outputApi.onTxSettled`.
  //
  //    - Multiple transactions may settle in the same block, so `onTxSettled` could be called
  //      multiple times per "newBlock" event.
  //    - Ensure callbacks are invoked in the same order as the transactions originally arrived.
  //

  // 2) When a transaction becomes "done"-meaning the block it was settled in gets finalized-
  //    you must call `outputApi.onTxDone`.
  //
  //    - Multiple transactions may complete upon a single "finalized" event.
  //    - As above, maintain the original arrival order when invoking `onTxDone`.
  //    - Keep in mind that the "finalized" event is not emitted for all finalized blocks.
  //
  // Notes:
  // - It is **not** ok to make redundant calls to either `onTxSettled` or `onTxDone`.
  // - It is ok to make redundant calls to `getBody`, `isTxValid` and `isTxSuccessful`
  //
  // Bonus 1:
  // - Avoid making redundant calls to `getBody`, `isTxValid` and `isTxSuccessful`.
  //
  // Bonus 2:
  // - Upon receiving a "finalized" event, call `api.unpin` to unpin blocks that are either:
  //     a) pruned, or
  //     b) older than the currently finalized block.


  return (event: IncomingEvent) => {
    const onNewBlock = ({ blockHash, parent }: NewBlockEvent) => {
      // TODO:: implement it

      pastBlocks.push({ blockHash, parent })

      if (currentTransactions.length === 0) return;

      const body = api.getBody(blockHash)
      if (!body.length) {
        return
      }

      body.forEach((tx) => {
        for (const memoryTransaction of currentTransactions) {
          if (memoryTransaction.transaction === tx) {

            const memParent = pastBlocks.find((x) => x.blockHash === memoryTransaction.blockHash)?.parent
            if (memParent === parent) {
              //no need to check a decendant block
              return;
            }
            const isSuccess = api.isTxSuccessful(blockHash, tx)
            // if (isSuccess) {
            outputApi.onTxSettled(tx, { blockHash, type: 'valid', successful: isSuccess })
            memoryTransaction.isValid = true
            // }
          } else {
            memoryTransaction.isValid = api.isTxValid(blockHash, tx)
            if (!memoryTransaction.isValid) {
              outputApi.onTxSettled(tx, { blockHash, type: 'invalid' })
              const idx = currentTransactions.findIndex((x) => x.transaction === tx)
              currentTransactions[idx].blockHash = blockHash
            }
          }
        }


      })
    }

    const onNewTx = ({ value: transaction }: NewTransactionEvent) => {
      // TODO:: implement it
      // console.log("onNewTx", transaction)
      currentTransactions.push({ transaction, isValid: false, blockHash: '' })
    }

    const onFinalized = ({ blockHash }: FinalizedEvent) => {
      // TODO:: implement it
      const body = api.getBody(blockHash)
      if (!body.length) {
        return
      }
      body.forEach((tx) => {
        const txIndex = currentTransactions.some((x) => x.transaction === tx)
        if (!txIndex) return
        outputApi.onTxDone(tx, { blockHash, type: 'valid', successful: api.isTxSuccessful(blockHash, tx) })
        currentTransactions.splice(currentTransactions.findIndex((x) => x.transaction === tx), 1)
      })
    }


    switch (event.type) {
      case "newBlock": {
        onNewBlock(event)
        break
      }
      case "newTransaction": {
        onNewTx(event)
        break
      }
      case "finalized":
        onFinalized(event)
    }

  }
}


