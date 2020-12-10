import * as RDF from 'rdf-js';
import { Level, log } from '../Utils/Logger';
const factory = require('rdf-ext')
const SHACLValidator = require('rdf-validate-shacl')

export async function validate( notificationDataset: any, shapesDataset: any) {  

  const validator = new SHACLValidator(shapesDataset, { factory })
  const report = await validator.validate(notificationDataset)

  log(Level.Log, `Shape conforms: ${report.conforms}, report length: ${report.results.length}`)
  for (const result of report.results) {
    // See https://www.w3.org/TR/shacl/#results-validation-result for details
    // about each property
    log(Level.Log, result.message)
    // console.log(result.path)
    // console.log(result.focusNode)
    // console.log(result.severity)
    // console.log(result.sourceConstraintComponent)
    // console.log(result.sourceShape)
  }
  return report.conforms
}
