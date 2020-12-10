import rdfParser from "rdf-parse";
import { streamToQuads } from './util';
const factory = require('rdf-ext')
const SHACLValidator = require('rdf-validate-shacl')

export async function validate( notificationQuadStream: any, shapeQuadStream: any) {
  console.log('HERE1', notificationQuadStream)
  console.log('HERE2', shapeQuadStream)
  const shapedata = await factory.dataset().import(shapeQuadStream)
  const data = await factory.dataset().import(notificationQuadStream)
  console.log('HERE11', await streamToQuads(notificationQuadStream))
  console.log('HERE22', await streamToQuads(shapeQuadStream))


  console.log('VALIDATING2')
  const validator = new SHACLValidator(shapedata, { factory })
  console.log('VALIDATING3')
  const report = await validator.validate(data)

  console.log('CONFORMS', report.conforms, report.results.length)
  for (const result of report.results) {
    // See https://www.w3.org/TR/shacl/#results-validation-result for details
    // about each property
    console.log(result.message)
    // console.log(result.path)
    // console.log(result.focusNode)
    // console.log(result.severity)
    // console.log(result.sourceConstraintComponent)
    // console.log(result.sourceShape)
  }


  return report.conforms
}

// console.log('CONFORMS', report.conforms, report.results.length)
// for (const result of report.results) {
//   // See https://www.w3.org/TR/shacl/#results-validation-result for details
//   // about each property
//   console.log(result.message)
//   // console.log(result.path)
//   // console.log(result.focusNode)
//   // console.log(result.severity)
//   // console.log(result.sourceConstraintComponent)
//   // console.log(result.sourceShape)
// }